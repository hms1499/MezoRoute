// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutor} from "./interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutor
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutor is IMezoRouteExecutor, ReentrancyGuard {
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

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IMezoRouteExecutor
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    /// @inheritdoc IMezoRouteExecutor
    function exit(ExitParams calldata p, Permit calldata lpPermit) external nonReentrant returns (uint256 musdOut) {
        if (p.liquidityIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();

        Balances memory start = _snapshot();

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

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256 liquidityOut)
    {
        Balances memory start = _snapshot();

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

        uint256 musdForLiquidity = _delta(musd, start.musd);
        musd.forceApprove(address(router), musdForLiquidity);
        btc.forceApprove(address(router), btcFromSwap);
        uint256 musdAdded;
        uint256 btcAdded;
        (musdAdded, btcAdded, liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdForLiquidity,
            btcFromSwap,
            p.minMusdAdded,
            p.minBtcAdded,
            p.recipient,
            p.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (musdAdded < p.minMusdAdded || btcAdded < p.minBtcAdded || liquidityOut < p.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        uint256 musdRefund = _delta(musd, start.musd);
        uint256 btcRefund = _delta(btc, start.btc);
        if (musdRefund > 0) musd.safeTransfer(p.recipient, musdRefund);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            musdAdded,
            btcAdded,
            liquidityOut,
            musdRefund,
            btcRefund
        );
    }

    function _validateEnter(EnterParams calldata p) private view {
        if (p.musdIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();
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
