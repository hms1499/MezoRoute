// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteLeverage} from "./interfaces/IMezoRouteLeverage.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";
import {ITroveManagerMinimal} from "./interfaces/external/ITroveManagerMinimal.sol";
import {IPriceFeedMinimal} from "./interfaces/external/IPriceFeedMinimal.sol";
import {IPoolMinimal} from "./interfaces/external/IPoolMinimal.sol";
import {IPoolFactoryMinimal} from "./interfaces/external/IPoolFactoryMinimal.sol";

/// @title MezoRouteLeverage
/// @notice Non-custodial, immutable Trove actions in one transaction: the caller's MUSD Trove is
///         unwound, closed or levered through a flash swap on the MUSD/BTC Tigris pool.
/// @dev Every Trove action names the caller as both borrower and recipient. The leg that repays the
///      pool is paid from the caller's wallet: the signed maximum is pulled, the pool gets the exact
///      input, the rest is refunded, so a permit for the maximum ends at a zero allowance. MUSD and BTC
///      balances end every call where they started; nothing held before a call is ever paid out.
contract MezoRouteLeverage is IMezoRouteLeverage, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 public constant MAX_DEVIATION_BPS = 1_000;
    uint256 public constant MIN_CR_FLOOR = 1.5e18;
    uint256 public constant GAS_COMPENSATION = 200e18;
    uint256 private constant BPS = 10_000;

    uint256 private constant OP_NONE = 0;
    uint256 private constant OP_UNWIND = 1;
    uint256 private constant OP_CLOSE = 2;
    uint256 private constant OP_LEVERAGE = 3;
    uint256 private constant OP_OPEN = 4;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IPoolFactoryMinimal public immutable factory;
    IPoolMinimal public immutable pool;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    ITroveManagerMinimal public immutable troveManager;
    IPriceFeedMinimal public immutable priceFeed;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;
    /// @notice Per-transaction cap on the BTC a Leverage or Open flashes.
    uint256 public immutable maxBtcFlash;
    /// @notice Per-transaction cap on the MUSD an Unwind or Close flashes.
    uint256 public immutable maxMusdFlash;
    bool public immutable btcIsToken0;

    /// @dev The operation in flight (London: no transient storage); the hook accepts only that one.
    uint256 private _op;
    /// @dev The hook's result for the outer call, cleared after reading.
    uint256 private _result;

    constructor(Config memory c) {
        if (
            c.musd == address(0) || c.btc == address(0) || c.factory == address(0) || c.pool == address(0)
                || c.borrowerOperationsSignatures == address(0) || c.troveManager == address(0)
                || c.priceFeed == address(0) || c.feeRecipient == address(0)
        ) revert ZeroAddress();
        if (c.maxBtcFlash == 0 || c.maxMusdFlash == 0) revert ZeroAmount();
        if (c.feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (IPoolFactoryMinimal(c.factory).getPool(c.musd, c.btc, false) != c.pool) revert PoolMismatch();

        musd = IERC20(c.musd);
        btc = IERC20(c.btc);
        factory = IPoolFactoryMinimal(c.factory);
        pool = IPoolMinimal(c.pool);
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(c.borrowerOperationsSignatures);
        troveManager = ITroveManagerMinimal(c.troveManager);
        priceFeed = IPriceFeedMinimal(c.priceFeed);
        feeBps = c.feeBps;
        feeRecipient = c.feeRecipient;
        maxBtcFlash = c.maxBtcFlash;
        maxMusdFlash = c.maxMusdFlash;
        btcIsToken0 = IPoolMinimal(c.pool).token0() == c.btc;
    }

    // ------------------------------------------------------------------ entry points

    /// @inheritdoc IMezoRouteLeverage
    function unwind(UnwindParams calldata p, TroveAuth calldata a, Permit calldata btcPermit)
        external
        nonReentrant
        returns (uint256 btcToPool)
    {
        if (p.debtToRepay == 0) revert ZeroAmount();
        if (p.debtToRepay > maxMusdFlash) revert AmountAboveCap();
        _checkCommon(p.deadline, p.maxDeviationBps);

        (uint256 musdStart, uint256 btcStart) = _balances();
        btcToPool = _flash(OP_UNWIND, false, p.debtToRepay, abi.encode(p, a, btcPermit));
        _verifyBalances(musdStart, btcStart);
        emit Unwound(msg.sender, p.debtToRepay, p.collWithdrawal, btcToPool);
    }

    /// @inheritdoc IMezoRouteLeverage
    function close(CloseParams calldata p, TroveAuth calldata a, Permit calldata btcPermit)
        external
        nonReentrant
        returns (uint256 btcToPool)
    {
        _checkCommon(p.deadline, p.maxDeviationBps);
        // Brings interest and pending redistribution in, so the debt read next is what the close burns.
        troveManager.updateSystemAndTroveInterest(msg.sender);
        uint256 debt = troveManager.getTroveDebt(msg.sender);
        if (debt <= GAS_COMPENSATION) revert ZeroAmount(); // no active Trove
        uint256 musdNeeded = debt - GAS_COMPENSATION; // the gas compensation is burned from the gas pool
        if (musdNeeded > maxMusdFlash) revert AmountAboveCap();
        uint256 coll = troveManager.getTroveColl(msg.sender);

        (uint256 musdStart, uint256 btcStart) = _balances();
        btcToPool = _flash(OP_CLOSE, false, musdNeeded, abi.encode(p, a, btcPermit, musdNeeded));
        _verifyBalances(musdStart, btcStart);
        emit Closed(msg.sender, musdNeeded, coll, btcToPool);
    }

    // ------------------------------------------------------------------ flash callback

    /// @notice Tigris flash-swap callback; only the pool, during an operation this contract started.
    function hook(address sender, uint256, uint256, bytes calldata data) external {
        // Authenticate before touching `data`: only the pool, for a swap this contract started.
        if (msg.sender != address(pool) || sender != address(this) || _op == OP_NONE) revert UnauthorizedHook();
        (uint256 op, address borrower, bytes memory payload) = abi.decode(data, (uint256, address, bytes));
        if (op != _op) revert UnauthorizedHook();
        if (op == OP_UNWIND) _result = _hookUnwind(borrower, payload);
        else if (op == OP_CLOSE) _result = _hookClose(borrower, payload);
        else revert UnauthorizedHook();
    }

    function _hookUnwind(address borrower, bytes memory payload) private returns (uint256 btcToPool) {
        (UnwindParams memory p, TroveAuth memory a, Permit memory permit) =
            abi.decode(payload, (UnwindParams, TroveAuth, Permit));
        borrowerOperationsSignatures.adjustTroveWithSignature(
            p.collWithdrawal,
            p.debtToRepay,
            false,
            a.upperHint,
            a.lowerHint,
            borrower,
            borrower,
            a.signature,
            a.deadline
        );
        btcToPool = _exactPoolInput(true, p.debtToRepay);
        if (btcToPool > p.maxBtcToPool) revert PoolInputAboveMax();
        _checkSellBound(btcToPool, p.debtToRepay, p.maxDeviationBps);
        _pullPayRefund(btc, borrower, p.maxBtcToPool, btcToPool, permit);
    }

    function _hookClose(address borrower, bytes memory payload) private returns (uint256 btcToPool) {
        (CloseParams memory p, TroveAuth memory a, Permit memory permit, uint256 musdNeeded) =
            abi.decode(payload, (CloseParams, TroveAuth, Permit, uint256));
        borrowerOperationsSignatures.closeTroveWithSignature(borrower, borrower, a.signature, a.deadline);
        btcToPool = _exactPoolInput(true, musdNeeded);
        if (btcToPool > p.maxBtcToPool) revert PoolInputAboveMax();
        _checkSellBound(btcToPool, musdNeeded, p.maxDeviationBps);
        _pullPayRefund(btc, borrower, p.maxBtcToPool, btcToPool, permit);
    }

    // ------------------------------------------------------------------ pool maths

    /// @notice Smallest input the pool's K check accepts for `amountOut`, with the fee taken on input
    ///         (volatile x·y; Tigris moves the fee out of the pool before checking K).
    function exactInput(uint256 reserveIn, uint256 reserveOut, uint256 amountOut, uint256 feeBps_)
        public
        pure
        returns (uint256 x)
    {
        if (amountOut == 0 || amountOut >= reserveOut) revert ZeroAmount();
        uint256 product = reserveIn * reserveOut;
        uint256 remaining = reserveOut - amountOut;
        uint256 need = (product + remaining - 1) / remaining - reserveIn; // net input after the fee
        x = (need * BPS + (BPS - feeBps_) - 1) / (BPS - feeBps_);
        while (x > 0 && _netOfFee(x - 1, feeBps_) >= need) x--;
        while (_netOfFee(x, feeBps_) < need) x++;
    }

    function _netOfFee(uint256 x, uint256 feeBps_) private pure returns (uint256) {
        return x - (x * feeBps_) / BPS;
    }

    /// @dev Input the pool needs now for `amountOut` of the other token; `btcIn` says which side pays.
    function _exactPoolInput(bool btcIn, uint256 amountOut) private view returns (uint256) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 reserveBtc, uint256 reserveMusd) = btcIsToken0 ? (r0, r1) : (r1, r0);
        uint256 fee = factory.getFee(address(pool), false);
        return btcIn
            ? exactInput(reserveBtc, reserveMusd, amountOut, fee)
            : exactInput(reserveMusd, reserveBtc, amountOut, fee);
    }

    // ------------------------------------------------------------------ internals

    function _checkCommon(uint256 deadline, uint256 maxDeviationBps) private view {
        if (block.timestamp > deadline) revert Expired();
        if (maxDeviationBps > MAX_DEVIATION_BPS) revert DeviationTooHigh();
    }

    /// @dev Flashes `amountOut` of BTC (`btcOut`) or MUSD to this contract and runs `op` in the hook.
    function _flash(uint256 op, bool btcOut, uint256 amountOut, bytes memory payload) private returns (uint256 result) {
        bool outIsToken0 = btcOut == btcIsToken0;
        _op = op;
        pool.swap(
            outIsToken0 ? amountOut : 0, outIsToken0 ? 0 : amountOut, address(this), abi.encode(op, msg.sender, payload)
        );
        _op = OP_NONE;
        result = _result;
        _result = 0;
    }

    /// @dev Selling `btcIn` for `musdOut` may be at most `maxDeviationBps` worse than PriceFeed.
    function _checkSellBound(uint256 btcIn, uint256 musdOut, uint256 maxDeviationBps) private view {
        uint256 price = priceFeed.fetchPrice();
        if (btcIn * price * BPS > musdOut * 1e18 * (BPS + maxDeviationBps)) revert OracleBoundExceeded();
    }

    /// @dev Pulls `max` from `from` (after an optional permit), pays `exact` to the pool, refunds the rest.
    function _pullPayRefund(IERC20 token, address from, uint256 max, uint256 exact, Permit memory permit) private {
        if (permit.value > 0) {
            // A permit already used (e.g. front-run) leaves its allowance in place: fall back to it.
            try IERC20Permit(address(token))
                .permit(from, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        token.safeTransferFrom(from, address(this), max);
        token.safeTransfer(address(pool), exact);
        if (max > exact) token.safeTransfer(from, max - exact);
    }

    function _balances() private view returns (uint256, uint256) {
        return (musd.balanceOf(address(this)), btc.balanceOf(address(this)));
    }

    function _verifyBalances(uint256 musdStart, uint256 btcStart) private view {
        (uint256 musdEnd, uint256 btcEnd) = _balances();
        if (musdEnd != musdStart || btcEnd != btcStart) revert UnexpectedBalanceChange();
    }
}
