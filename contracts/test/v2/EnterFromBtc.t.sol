// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IRouter} from "@tigris/interfaces/IRouter.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {IGauge} from "@tigris/interfaces/IGauge.sol";
import {Vm} from "forge-std/Vm.sol";
import {TigrisHarnessV2} from "../harness/TigrisHarnessV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {ReentrantMUSD} from "../mocks/ReentrantMUSD.sol";

contract EnterFromBtcV2Test is TigrisHarnessV2 {
    uint256 internal constant BTC_IN = 0.1e18; // 10,000 MUSD at the seeded price
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function _lastEvent() internal view returns (Vm.Log memory entered) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (
                logs[i].emitter == address(executor)
                    && logs[i].topics[0] == IMezoRouteExecutorV2.EnteredFromBtc.selector
            ) {
                entered = logs[i];
            }
        }
        require(entered.emitter == address(executor), "no EnteredFromBtc");
    }

    function _signBtcPermit(uint256 value) internal view returns (IMezoRouteExecutorV2.Permit memory) {
        uint256 deadline = block.timestamp + 600;
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH, user, address(executor), value, IERC20Permit(address(btc)).nonces(user), deadline
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", IERC20Permit(address(btc)).DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        return IMezoRouteExecutorV2.Permit({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    function test_enterFromBtc_noStake_mintsLpToRecipient() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);

        vm.prank(user);
        uint256 lp = executor.enterFromBtc(p, _noPermit());

        assertGt(lp, 0);
        assertEq(IERC20(pool).balanceOf(user), lp);
        assertEq(gauge.balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
        assertEq(musd.allowance(address(executor), address(router)), 0);
    }

    function test_enterFromBtc_stake_creditsGauge() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, true);

        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enterFromBtc(p, _noPermit());

        assertEq(gauge.balanceOf(user), lp);
        assertEq(IERC20(pool).balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(gauge)), 0);

        Vm.Log memory e = _lastEvent();
        (,,,,,, uint256 lpOut,,) =
            abi.decode(e.data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256));
        assertEq(lpOut, lp);
    }

    function test_enterFromBtc_feeInBtc() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        assertEq(btc.balanceOf(feeRecipient), (BTC_IN * 10) / 10_000);
        assertEq(musd.balanceOf(feeRecipient), 0);
    }

    function test_enterFromBtc_revertsAboveCap() public {
        assertEq(executor.maxBtcIn(), MAX_BTC_IN);
        _fundBtc(user, MAX_BTC_IN + 1);

        IMezoRouteExecutorV2.EnterFromBtcParams memory over = _btcParams(MAX_BTC_IN + 1, user, false);
        vm.expectRevert(IMezoRouteExecutorV2.AmountAboveCap.selector);
        vm.prank(user);
        executor.enterFromBtc(over, _noPermit());

        IMezoRouteExecutorV2.EnterFromBtcParams memory atCap = _btcParams(MAX_BTC_IN, user, false);
        vm.prank(user);
        assertGt(executor.enterFromBtc(atCap, _noPermit()), 0);
    }

    function test_enterFromBtc_revertsOnBadSwapAmount() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        uint256 net = BTC_IN - (BTC_IN * FEE_BPS) / 10_000;

        p.btcToSwap = 0;
        vm.expectRevert(IMezoRouteExecutorV2.InvalidSwapAmount.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        p.btcToSwap = net;
        vm.expectRevert(IMezoRouteExecutorV2.InvalidSwapAmount.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        p.btcToSwap = net - 1; // the largest valid amount
        p.minMusdFromSwap = 0;
        vm.prank(user);
        assertGt(executor.enterFromBtc(p, _noPermit()), 0);
    }

    function test_enterFromBtc_slippageChecks() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);

        // The Router enforces amountOutMin first, so the swap minimum reverts inside it.
        p.minMusdFromSwap = _quoteSwap(address(btc), address(musd), p.btcToSwap) + 1;
        vm.expectRevert(IRouter.InsufficientOutputAmount.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        p = _btcParams(BTC_IN, user, false);
        p.minLpOut = type(uint256).max;
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientLiquidityOutput.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }

    /// @dev The executor's own check backs up the Router's: a Router that reports success but
    ///      delivers nothing (mocked here) is still rejected.
    function test_enterFromBtc_revertsWhenSwapDeliversLessThanMinimum() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        vm.mockCall(
            address(router),
            abi.encodeWithSelector(ITigrisRouter.swapExactTokensForTokens.selector),
            abi.encode(new uint256[](2))
        );
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientSwapOutput.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }

    function test_enterFromBtc_revertsOnBadRecipientAndInputs() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, address(0), false);
        vm.expectRevert(IMezoRouteExecutorV2.ZeroAddress.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        address[3] memory bad = [address(executor), pool, address(gauge)];
        for (uint256 i; i < 3; i++) {
            p.recipient = bad[i];
            vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
            vm.prank(user);
            executor.enterFromBtc(p, _noPermit());
        }

        p.recipient = user;
        p.btcIn = 0;
        vm.expectRevert(IMezoRouteExecutorV2.ZeroAmount.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        p.btcIn = BTC_IN;
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutorV2.Expired.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }

    function test_enterFromBtc_stake_revertsWithoutGaugeOrOnKilledGauge() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, true);

        voter.setAlive(false);
        vm.expectRevert(IGauge.NotAlive.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        executor = _deployExecutor(FEE_BPS, MAX_MUSD_IN, address(0));
        _fundBtc(user, BTC_IN);
        vm.expectRevert(IMezoRouteExecutorV2.GaugeUnavailable.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }

    function test_enterFromBtc_ignoresPreExistingBalances() public {
        musd.mint(address(executor), 500e18);
        btc.mint(address(executor), 1e18);
        uint256 donatedLp = 1e18;
        vm.prank(seeder);
        IERC20(pool).transfer(address(executor), donatedLp);

        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, true);
        uint256 musdQuote = _quoteSwap(address(btc), address(musd), p.btcToSwap);

        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enterFromBtc(p, _noPermit());

        assertEq(musd.balanceOf(address(executor)), 500e18);
        assertEq(btc.balanceOf(address(executor)), 1e18);
        assertEq(IERC20(pool).balanceOf(address(executor)), donatedLp);
        assertEq(gauge.balanceOf(user), lp);
        assertLt(musd.balanceOf(user), 500e18);
        assertLt(btc.balanceOf(user), 1e18);

        // The app's cost basis reads the event: donated tokens must not show up in it.
        Vm.Log memory e = _lastEvent();
        (
            uint256 btcIn,
            uint256 fee,
            uint256 btcToSwap,
            uint256 musdFromSwap,
            uint256 musdAdded,
            uint256 btcAdded,
            uint256 lpOut,
            uint256 musdRefund,
            uint256 btcRefund
        ) = abi.decode(e.data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256));
        assertEq(btcIn, BTC_IN);
        assertEq(fee, (BTC_IN * FEE_BPS) / 10_000);
        assertEq(btcToSwap, p.btcToSwap);
        assertEq(musdFromSwap, musdQuote);
        assertEq(musdFromSwap, musdAdded + musdRefund);
        assertEq(btcIn - fee, btcToSwap + btcAdded + btcRefund);
        assertEq(lpOut, lp);
        assertEq(musd.balanceOf(user), musdRefund);
        assertEq(btc.balanceOf(user), btcRefund);
    }

    /// @dev The Router enforces its own minimum, so reaching the executor's check needs a Router
    ///      that reports success but delivers nothing (mocked here).
    function test_enterFromBtc_swapMinimumNotSatisfiedByDonatedMusd() public {
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        musd.mint(address(executor), p.minMusdFromSwap);
        vm.mockCall(
            address(router),
            abi.encodeWithSelector(ITigrisRouter.swapExactTokensForTokens.selector),
            abi.encode(new uint256[](2))
        );
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientSwapOutput.selector);
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }

    function test_enterFromBtc_refundsToRecipient() public {
        address recipient = makeAddr("recipient");
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, recipient, true);

        vm.recordLogs();
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());

        Vm.Log memory e = _lastEvent();
        assertEq(address(uint160(uint256(e.topics[1]))), user);
        assertEq(address(uint160(uint256(e.topics[2]))), recipient);
        (
            uint256 btcIn,
            uint256 fee,
            uint256 btcToSwap,
            uint256 musdFromSwap,
            uint256 musdAdded,
            uint256 btcAdded,
            uint256 lpOut,
            uint256 musdRefund,
            uint256 btcRefund
        ) = abi.decode(e.data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256));

        assertEq(btcIn, BTC_IN);
        assertEq(fee, (BTC_IN * 10) / 10_000);
        assertEq(btcIn - fee, btcToSwap + btcAdded + btcRefund);
        assertEq(musdFromSwap, musdAdded + musdRefund);
        assertEq(musd.balanceOf(recipient), musdRefund);
        assertEq(btc.balanceOf(recipient), btcRefund);
        assertGt(musdRefund + btcRefund, 0);
        assertEq(gauge.balanceOf(recipient), lpOut);
        assertEq(musd.balanceOf(user), 0);
        assertEq(btc.balanceOf(user), 0);
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
    }

    /// @dev Swapping well below the optimum leaves most BTC unpaired, so it is refunded.
    function _assertBtcRefundReachesRecipient(bool stake) internal {
        address recipient = makeAddr("recipient");
        _fundBtc(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, recipient, stake);
        p.btcToSwap = BTC_IN / 10;
        p.minMusdFromSwap = 0;

        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enterFromBtc(p, _noPermit());

        (,,,,,,,, uint256 btcRefund) = abi.decode(
            _lastEvent().data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        assertGt(btcRefund, 0);
        assertEq(btc.balanceOf(recipient), btcRefund);
        assertEq(btc.balanceOf(user), 0);
        assertEq(stake ? gauge.balanceOf(recipient) : IERC20(pool).balanceOf(recipient), lp);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_enterFromBtc_refundsBtcToRecipientNotCaller() public {
        _assertBtcRefundReachesRecipient(false);
    }

    function test_enterFromBtc_stake_refundsBtcToRecipientNotCaller() public {
        _assertBtcRefundReachesRecipient(true);
    }

    function test_enterFromBtc_permit_andFrontRunPermit() public {
        btc.mint(user, 2 * BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        IMezoRouteExecutorV2.Permit memory permit = _signBtcPermit(BTC_IN);

        vm.prank(user);
        assertGt(executor.enterFromBtc(p, permit), 0);
        assertEq(btc.allowance(user, address(executor)), 0);

        // A front-run permit consumes the nonce; the allowance it set is what the call needs.
        permit = _signBtcPermit(BTC_IN);
        IERC20Permit(address(btc))
            .permit(user, address(executor), permit.value, permit.deadline, permit.v, permit.r, permit.s);
        vm.prank(user);
        assertGt(executor.enterFromBtc(p, permit), 0);
    }

    function test_enterFromBtc_revertsWithoutPermitOrApproval() public {
        btc.mint(user, BTC_IN);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(BTC_IN, user, false);
        vm.expectRevert("ERC20: insufficient allowance");
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }
}

/// @dev A BTC token that re-enters the executor during its first transfer.
contract EnterFromBtcReentrancyV2Test is TigrisHarnessV2 {
    function _newBtc() internal override returns (MockERC20Permit) {
        return MockERC20Permit(address(new ReentrantMUSD()));
    }

    function test_enterFromBtc_reentrancy() public {
        uint256 btcIn = 0.1e18;
        _fundBtc(user, 2 * btcIn);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = _btcParams(btcIn, user, false);
        ReentrantMUSD(address(btc))
            .arm(address(executor), abi.encodeCall(IMezoRouteExecutorV2.enterFromBtc, (p, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.enterFromBtc(p, _noPermit());
    }
}
