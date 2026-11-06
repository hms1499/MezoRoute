// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutorV2} from "./interfaces/IMezoRouteExecutorV2.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IGaugeMinimal} from "./interfaces/external/IGaugeMinimal.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutorV2
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool. Adds optional
///         staking of the new LP in the pool's Tigris gauge.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutorV2 is IMezoRouteExecutorV2, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IERC20 public immutable pool;
    ITigrisRouter public immutable router;
    address public immutable factory;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;
    /// @notice Per-transaction cap on `musdIn` for entries; exits are never capped.
    uint256 public immutable maxMusdIn;
    /// @notice The pool's Tigris gauge; `address(0)` when none exists (staking then reverts).
    IGaugeMinimal public immutable gauge;
    /// @notice Per-transaction cap on BTC entries; exits are never capped.
    uint256 public immutable maxBtcIn;

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    struct LiquidityArgs {
        uint256 minMusdAdded;
        uint256 minBtcAdded;
        uint256 minLpOut;
        uint256 deadline;
        address recipient;
        bool stake;
    }

    struct Result {
        uint256 musdAdded;
        uint256 btcAdded;
        uint256 liquidityOut;
        uint256 musdRefund;
        uint256 btcRefund;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_,
        uint256 maxMusdIn_,
        address gauge_,
        uint256 maxBtcIn_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (maxMusdIn_ == 0 || maxBtcIn_ == 0) revert ZeroAmount();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        // addLiquidity/removeLiquidity always use the Router's default factory; the swap route
        // must use the same one or entry and exit would touch two different pools.
        if (ITigrisRouter(router_).defaultFactory() != factory_) revert FactoryMismatch();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        if (gauge_ != address(0) && IGaugeMinimal(gauge_).stakingToken() != pool_) revert GaugeMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        maxMusdIn = maxMusdIn_;
        gauge = IGaugeMinimal(gauge_);
        maxBtcIn = maxBtcIn_;
    }

    /// @inheritdoc IMezoRouteExecutorV2
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    /// @inheritdoc IMezoRouteExecutorV2
    function borrowAndEnter(Borrow calldata b, Permit calldata musdPermit, EnterParams calldata p)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        if (p.recipient != msg.sender) revert NotBorrower();
        if (p.musdIn != b.amount) revert BorrowAmountMismatch();

        // Borrower and recipient are both the caller: a front-run of this signature can only
        // deliver the borrowed MUSD to the caller's own wallet.
        borrowerOperationsSignatures.withdrawMUSDWithSignature(
            b.amount, b.upperHint, b.lowerHint, msg.sender, msg.sender, b.signature, b.deadline
        );
        return _enter(p, musdPermit, b.amount);
    }

    /// @inheritdoc IMezoRouteExecutorV2
    function exit(ExitParams calldata p, Permit calldata lpPermit) external nonReentrant returns (uint256 musdOut) {
        if (p.liquidityIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        _requireValidRecipient(p.recipient);
        if (block.timestamp > p.deadline) revert Expired();

        Balances memory start = _snapshot();

        _tryPermit(address(pool), lpPermit);
        pool.safeTransferFrom(msg.sender, address(this), p.liquidityIn);

        pool.forceApprove(address(router), p.liquidityIn);
        router.removeLiquidity(
            address(musd),
            address(btc),
            false,
            p.liquidityIn,
            p.minMusdRemoved,
            p.minBtcRemoved,
            address(this),
            p.deadline
        );
        pool.forceApprove(address(router), 0);

        uint256 musdRemoved = _delta(musd, start.musd);
        uint256 btcRemoved = _delta(btc, start.btc);
        if (musdRemoved < p.minMusdRemoved || btcRemoved < p.minBtcRemoved) revert InsufficientLiquidityOutput();

        uint256 musdFromSwap;
        if (btcRemoved > 0) {
            btc.forceApprove(address(router), btcRemoved);
            router.swapExactTokensForTokens(
                btcRemoved, p.minMusdFromSwap, _route(address(btc), address(musd)), address(this), p.deadline
            );
            btc.forceApprove(address(router), 0);
            musdFromSwap = _delta(musd, start.musd) - musdRemoved;
        }
        if (musdFromSwap < p.minMusdFromSwap) revert InsufficientSwapOutput();

        musdOut = _delta(musd, start.musd);
        if (musdOut < p.minMusdOut) revert InsufficientFinalOutput();
        musd.safeTransfer(p.recipient, musdOut);

        uint256 btcRefund = _delta(btc, start.btc);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Exited(msg.sender, p.recipient, p.liquidityIn, musdRemoved, btcRemoved, musdFromSwap, musdOut, btcRefund);
    }

    /// @inheritdoc IMezoRouteExecutorV2
    function enterFromBtc(EnterFromBtcParams calldata p, Permit calldata btcPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEntry(p.stake, p.btcIn, maxBtcIn, p.recipient, p.deadline);

        Balances memory start = _snapshot();

        _tryPermit(address(btc), btcPermit);
        btc.safeTransferFrom(msg.sender, address(this), p.btcIn);

        uint256 fee = (p.btcIn * feeBps) / BPS;
        if (fee > 0) btc.safeTransfer(feeRecipient, fee);
        if (p.btcToSwap == 0 || p.btcToSwap >= p.btcIn - fee) revert InvalidSwapAmount();

        btc.forceApprove(address(router), p.btcToSwap);
        router.swapExactTokensForTokens(
            p.btcToSwap, p.minMusdFromSwap, _route(address(btc), address(musd)), address(this), p.deadline
        );
        btc.forceApprove(address(router), 0);

        uint256 musdFromSwap = _delta(musd, start.musd);
        if (musdFromSwap < p.minMusdFromSwap) revert InsufficientSwapOutput();

        Result memory r = _addLiquidity(
            start,
            musdFromSwap,
            _delta(btc, start.btc),
            LiquidityArgs(p.minMusdAdded, p.minBtcAdded, p.minLpOut, p.deadline, p.recipient, p.stake)
        );

        emit EnteredFromBtc(
            msg.sender,
            p.recipient,
            p.btcIn,
            fee,
            p.btcToSwap,
            musdFromSwap,
            r.musdAdded,
            r.btcAdded,
            r.liquidityOut,
            r.musdRefund,
            r.btcRefund
        );
        return r.liquidityOut;
    }

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256)
    {
        Balances memory start = _snapshot();

        _tryPermit(address(musd), musdPermit);
        musd.safeTransferFrom(msg.sender, address(this), p.musdIn);

        uint256 fee = (p.musdIn * feeBps) / BPS;
        if (fee > 0) musd.safeTransfer(feeRecipient, fee);
        if (p.musdToSwap == 0 || p.musdToSwap >= p.musdIn - fee) revert InvalidSwapAmount();

        musd.forceApprove(address(router), p.musdToSwap);
        router.swapExactTokensForTokens(
            p.musdToSwap, p.minBtcFromSwap, _route(address(musd), address(btc)), address(this), p.deadline
        );
        musd.forceApprove(address(router), 0);

        uint256 btcFromSwap = _delta(btc, start.btc);
        if (btcFromSwap < p.minBtcFromSwap) revert InsufficientSwapOutput();

        Result memory r = _addLiquidity(
            start,
            _delta(musd, start.musd),
            btcFromSwap,
            LiquidityArgs(p.minMusdAdded, p.minBtcAdded, p.minLpOut, p.deadline, p.recipient, p.stake)
        );

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            r.musdAdded,
            r.btcAdded,
            r.liquidityOut,
            r.musdRefund,
            r.btcRefund
        );
        return r.liquidityOut;
    }

    /// @dev Shared tail of both entries: add liquidity in `(musd, btc)` order, stake or hand the LP
    ///      to the recipient, refund every leftover to the recipient, and check nothing decreased.
    function _addLiquidity(Balances memory start, uint256 musdDesired, uint256 btcDesired, LiquidityArgs memory a)
        private
        returns (Result memory r)
    {
        musd.forceApprove(address(router), musdDesired);
        btc.forceApprove(address(router), btcDesired);
        (r.musdAdded, r.btcAdded, r.liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdDesired,
            btcDesired,
            a.minMusdAdded,
            a.minBtcAdded,
            a.stake ? address(this) : a.recipient,
            a.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (r.musdAdded < a.minMusdAdded || r.btcAdded < a.minBtcAdded || r.liquidityOut < a.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        if (a.stake) {
            // Stake what the executor measurably received, which must be what the Router reported.
            if (_delta(pool, start.lp) != r.liquidityOut) revert LiquidityNotReceived();
            _stake(r.liquidityOut, a.recipient);
            // The gauge must have pulled all of it: no LP may stay behind in the executor.
            if (pool.balanceOf(address(this)) != start.lp) revert StakeIncomplete();
        }

        r.musdRefund = _delta(musd, start.musd);
        r.btcRefund = _delta(btc, start.btc);
        if (r.musdRefund > 0) musd.safeTransfer(a.recipient, r.musdRefund);
        if (r.btcRefund > 0) btc.safeTransfer(a.recipient, r.btcRefund);

        _assertNoDecrease(start);
    }

    /// @dev The LP sits in the executor only for the duration of this call. The gauge must credit
    ///      exactly `amount` to `recipient`, and its allowance is reset to 0.
    function _stake(uint256 amount, address recipient) private {
        uint256 before = gauge.balanceOf(recipient);
        pool.forceApprove(address(gauge), amount);
        gauge.deposit(amount, recipient);
        pool.forceApprove(address(gauge), 0);
        if (gauge.balanceOf(recipient) != before + amount) revert StakeNotCredited();
        emit Staked(recipient, amount);
    }

    function _validateEnter(EnterParams calldata p) private view {
        _validateEntry(p.stake, p.musdIn, maxMusdIn, p.recipient, p.deadline);
    }

    function _validateEntry(bool stake, uint256 amountIn, uint256 cap, address recipient, uint256 deadline)
        private
        view
    {
        if (stake && address(gauge) == address(0)) revert GaugeUnavailable();
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > cap) revert AmountAboveCap();
        if (recipient == address(0)) revert ZeroAddress();
        _requireValidRecipient(recipient);
        if (block.timestamp > deadline) revert Expired();
    }

    /// @dev Tokens sent to this contract, the pool, or the gauge cannot be recovered by the user:
    ///      the executor has no withdrawal path, the pool pays balances to the next caller, and the
    ///      gauge credits LP only to the account it was deposited for.
    function _requireValidRecipient(address recipient) private view {
        if (recipient == address(this) || recipient == address(pool) || recipient == address(gauge)) {
            revert InvalidRecipient();
        }
    }

    /// @dev A front-run permit consumes the nonce and makes this call revert; the allowance it
    ///      set is still in place, so the failure is ignored and transferFrom decides.
    function _tryPermit(address token, Permit calldata permit_) private {
        if (permit_.value == 0) return;
        try IERC20Permit(token)
            .permit(msg.sender, address(this), permit_.value, permit_.deadline, permit_.v, permit_.r, permit_.s) {}
            catch {}
    }

    function _route(address from, address to) private view returns (ITigrisRouter.Route[] memory routes) {
        routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _snapshot() private view returns (Balances memory b) {
        b.musd = musd.balanceOf(address(this));
        b.btc = btc.balanceOf(address(this));
        b.lp = pool.balanceOf(address(this));
    }

    function _delta(IERC20 token, uint256 startBalance) private view returns (uint256) {
        uint256 current = token.balanceOf(address(this));
        if (current < startBalance) revert UnexpectedBalanceDecrease();
        return current - startBalance;
    }

    function _assertNoDecrease(Balances memory start) private view {
        if (
            musd.balanceOf(address(this)) < start.musd || btc.balanceOf(address(this)) < start.btc
                || pool.balanceOf(address(this)) < start.lp
        ) revert UnexpectedBalanceDecrease();
    }
}
