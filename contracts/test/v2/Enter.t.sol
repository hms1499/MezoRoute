// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "forge-std/Vm.sol";
import {TigrisHarnessV2} from "../harness/TigrisHarnessV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {MezoRouteExecutorV2} from "../../src/MezoRouteExecutorV2.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";

contract EnterV2Test is TigrisHarnessV2 {
    function test_enter_mintsLpToRecipientAndChargesFee() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);

        vm.prank(user);
        uint256 liquidityOut = executor.enter(p, _noPermit());

        assertGt(liquidityOut, 0);
        assertEq(IERC20(pool).balanceOf(user), liquidityOut);
        assertEq(musd.balanceOf(feeRecipient), 1e18); // 10 bps of 1,000 MUSD
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
    }

    function test_enter_emitsEventMatchingBalanceChanges() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);

        vm.recordLogs();
        vm.prank(user);
        uint256 liquidityOut = executor.enter(p, _noPermit());

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory entered = logs[logs.length - 1];
        assertEq(entered.topics[0], IMezoRouteExecutorV2.Entered.selector);
        (
            uint256 musdBorrowed,
            uint256 musdIn,
            uint256 fee,
            uint256 musdSwapped,,
            uint256 musdAdded,,
            uint256 lpOut,
            uint256 musdRefund,
        ) = abi.decode(
            entered.data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        assertEq(musdBorrowed, 0);
        assertEq(musdIn, 1_000e18);
        assertEq(fee, 1e18);
        assertEq(musdSwapped, p.musdToSwap);
        assertEq(lpOut, liquidityOut);
        assertEq(musdIn - fee, musdSwapped + musdAdded + musdRefund);
        assertEq(musd.balanceOf(user), musdRefund);
    }

    function test_enter_neverPaysOutPreExistingBalances() public {
        musd.mint(address(executor), 500e18);
        btc.mint(address(executor), 1e18);
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        uint256 btcQuote = _quoteSwap(address(musd), address(btc), p.musdToSwap);

        vm.recordLogs();
        vm.prank(user);
        executor.enter(p, _noPermit());

        assertEq(musd.balanceOf(address(executor)), 500e18);
        assertEq(btc.balanceOf(address(executor)), 1e18);
        assertLt(musd.balanceOf(user), 500e18);
        assertEq(btc.balanceOf(user) < 1e18, true);

        // The app's cost basis reads the event: donated tokens must not show up in it.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        (
            ,,
            uint256 fee,
            uint256 musdSwapped,
            uint256 btcFromSwap,
            uint256 musdAdded,
            uint256 btcAdded,,
            uint256 musdRefund,
            uint256 btcRefund
        ) = abi.decode(
            logs[logs.length - 1].data,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        assertEq(btcFromSwap, btcQuote);
        assertEq(btcFromSwap, btcAdded + btcRefund);
        assertEq(1_000e18 - fee, musdSwapped + musdAdded + musdRefund);
        assertEq(musd.balanceOf(user), musdRefund);
        assertEq(btc.balanceOf(user), btcRefund);
    }

    /// @dev The Router enforces its own minimum, so reaching the executor's check needs a Router
    ///      that reports success but delivers nothing (mocked here).
    function test_enter_swapMinimumNotSatisfiedByDonatedBtc() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        btc.mint(address(executor), p.minBtcFromSwap);
        vm.mockCall(
            address(router),
            abi.encodeWithSelector(ITigrisRouter.swapExactTokensForTokens.selector),
            abi.encode(new uint256[](2))
        );
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientSwapOutput.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_leavesNoRouterAllowance() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        executor.enter(p, _noPermit());

        assertEq(musd.allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_enter_revertsOnZeroAmount() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdIn = 0;
        vm.expectRevert(IMezoRouteExecutorV2.ZeroAmount.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsOnZeroRecipient() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, address(0));
        vm.expectRevert(IMezoRouteExecutorV2.ZeroAddress.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenExpired() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutorV2.Expired.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenSwapAmountLeavesNothingToAdd() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdToSwap = p.musdIn; // more than the post-fee amount
        vm.expectRevert(IMezoRouteExecutorV2.InvalidSwapAmount.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenSwapOutputBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.minBtcFromSwap = _quoteSwap(address(musd), address(btc), p.musdToSwap) + 1;
        vm.expectRevert(); // Router enforces amountOutMin first (IRouter.InsufficientOutputAmount)
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenLpBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.minLpOut = type(uint256).max;
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientLiquidityOutput.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    /// @dev The Router enforces both minimums first, so reaching the executor's checks needs a
    ///      Router that reports less than asked (mocked here).
    function test_enter_revertsWhenRouterReportsLessThanMinimumsAdded() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        vm.mockCall(
            address(router),
            abi.encodeWithSelector(ITigrisRouter.addLiquidity.selector),
            abi.encode(uint256(1), uint256(1), uint256(1))
        );

        p.minMusdAdded = 2;
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientLiquidityOutput.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());

        p.minMusdAdded = 0;
        p.minBtcAdded = 2;
        vm.expectRevert(IMezoRouteExecutorV2.InsufficientLiquidityOutput.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_withZeroFeeExecutorChargesNothing() public {
        executor = _deployExecutor(0);
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        executor.enter(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), 0);
    }

    function test_fee_roundsDownOnDustAmounts() public {
        _fund(user, 1_000e18 + 999);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdIn = 1_000e18 + 999; // 999 wei * 10 / 10_000 rounds to 0 extra
        vm.prank(user);
        executor.enter(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), 1e18);
    }

    function test_constructor_revertsAboveMaxFee() public {
        vm.expectRevert(IMezoRouteExecutorV2.FeeTooHigh.selector);
        _deployExecutor(51);
    }

    function test_constructor_revertsOnPoolMismatch() public {
        vm.expectRevert(IMezoRouteExecutorV2.PoolMismatch.selector);
        new MezoRouteExecutorV2(
            address(musd),
            address(btc),
            address(router),
            address(factory),
            address(musd),
            address(bos),
            10,
            feeRecipient,
            MAX_MUSD_IN,
            address(gauge),
            MAX_BTC_IN
        );
    }

    function test_enter_refundsResidueToRecipientNotCaller() public {
        address recipient = makeAddr("recipient");
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, recipient);
        p.musdToSwap = 100e18; // unbalanced on purpose: most MUSD cannot be paired and is refunded
        p.minBtcFromSwap = 0;

        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        assertEq(IERC20(pool).balanceOf(recipient), lp);
        assertGt(musd.balanceOf(recipient), 700e18);
        assertEq(musd.balanceOf(user), 0);
    }

    function test_enter_refundsBtcToRecipientNotCaller() public {
        address recipient = makeAddr("recipient");
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, recipient);
        p.musdToSwap = 900e18; // above the optimum: most BTC cannot be paired and is refunded
        p.minBtcFromSwap = 0;

        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        Vm.Log[] memory logs = vm.getRecordedLogs();
        (,,,,,,,,, uint256 btcRefund) = abi.decode(
            logs[logs.length - 1].data,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        assertGt(btcRefund, 0);
        assertEq(btc.balanceOf(recipient), btcRefund);
        assertEq(btc.balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(recipient), lp);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_enter_acceptsDeadlineEqualToNow() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.deadline = block.timestamp;
        vm.prank(user);
        assertGt(executor.enter(p, _noPermit()), 0);
    }

    function test_enter_revertsWhenRecipientIsExecutor() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, address(executor));
        vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenRecipientIsPool() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, pool);
        vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenMusdAddedBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.minMusdAdded = p.musdIn;
        vm.expectRevert();
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenBtcAddedBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        p.minBtcAdded = 1e18;
        vm.expectRevert();
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_neverPaysOutPreExistingLp() public {
        uint256 donated = IERC20(pool).balanceOf(seeder) / 1_000;
        vm.prank(seeder);
        IERC20(pool).transfer(address(executor), donated);
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);

        vm.prank(user);
        uint256 liquidityOut = executor.enter(p, _noPermit());

        assertEq(IERC20(pool).balanceOf(address(executor)), donated);
        assertEq(IERC20(pool).balanceOf(user), liquidityOut);
    }
}
