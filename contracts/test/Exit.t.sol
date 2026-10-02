// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract ExitTest is TigrisHarness {
    uint256 internal lp;

    function setUp() public override {
        super.setUp();
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.startPrank(user);
        lp = executor.enter(p, _noPermit());
        IERC20(pool).approve(address(executor), type(uint256).max);
        vm.stopPrank();
    }

    function test_exit_roundTripReturnsMusdMinusCosts() public {
        uint256 musdBefore = musd.balanceOf(user);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);

        vm.prank(user);
        uint256 musdOut = executor.exit(p, _noPermit());

        assertEq(musd.balanceOf(user) - musdBefore, musdOut);
        assertGt(musdOut, 990e18); // 10 bps fee + 2 x 0.3% swap fees + rounding
        assertLt(musdOut, 1_000e18);
        assertEq(IERC20(pool).balanceOf(user), 0);
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
    }

    function test_exit_chargesNoFee() public {
        uint256 feeBefore = musd.balanceOf(feeRecipient);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), feeBefore);
    }

    function test_exit_neverPaysOutPreExistingBalances() public {
        musd.mint(address(executor), 500e18);
        btc.mint(address(executor), 1e18);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);

        vm.prank(user);
        uint256 musdOut = executor.exit(p, _noPermit());

        assertEq(musd.balanceOf(address(executor)), 500e18);
        assertEq(btc.balanceOf(address(executor)), 1e18);
        assertLt(musdOut, 1_000e18);
    }

    function test_exit_partialAmount() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp / 2, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).balanceOf(user), lp - lp / 2);
    }

    function test_exit_leavesNoRouterAllowance() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_exit_revertsWhenFinalOutputBelowMinimum() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        p.minMusdOut = 1_000e18;
        vm.expectRevert(IMezoRouteExecutor.InsufficientFinalOutput.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsOnZeroLiquidity() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(0, user);
        vm.expectRevert(IMezoRouteExecutor.ZeroAmount.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenExpired() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutor.Expired.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_dustLiquidityReverts() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(1, user);
        vm.expectRevert(); // Pool.burn reverts InsufficientLiquidityBurned; nothing is lost silently
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).balanceOf(user), lp);
    }

    function test_exit_revertsWhenRecipientIsExecutor() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, address(executor));
        vm.expectRevert(IMezoRouteExecutor.InvalidRecipient.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenRecipientIsPool() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, pool);
        vm.expectRevert(IMezoRouteExecutor.InvalidRecipient.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function testFuzz_roundTrip_neverProfitsAndKeepsResidues(uint256 amount, uint256 donation) public {
        amount = bound(amount, 1e18, 50_000e18);
        donation = bound(donation, 0, 1_000e18);
        address alice = makeAddr("alice");
        musd.mint(address(executor), donation);
        btc.mint(address(executor), donation / 100_000);
        uint256 residueMusd = musd.balanceOf(address(executor));
        uint256 residueBtc = btc.balanceOf(address(executor));

        _fund(alice, amount);
        IMezoRouteExecutor.EnterParams memory ep = _enterParams(amount, alice);
        vm.startPrank(alice);
        uint256 got = executor.enter(ep, _noPermit());
        IERC20(pool).approve(address(executor), got);
        executor.exit(_exitParams(got, alice), _noPermit());
        vm.stopPrank();

        assertLe(musd.balanceOf(alice), amount);
        assertEq(musd.balanceOf(address(executor)), residueMusd);
        assertEq(btc.balanceOf(address(executor)), residueBtc);
    }

    function test_exit_revertsOnZeroRecipient() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, address(0));
        vm.expectRevert(IMezoRouteExecutor.ZeroAddress.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenRemovedMusdBelowMinimum() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        p.minMusdRemoved = 1_000e18;
        vm.expectRevert(); // Router enforces amountAMin first (IRouter.InsufficientAmountA)
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenRemovedBtcBelowMinimum() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        p.minBtcRemoved = 1e18;
        vm.expectRevert();
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenSwapOutputBelowMinimum() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        p.minMusdFromSwap = 1_000e18;
        vm.expectRevert(); // Router enforces amountOutMin first (IRouter.InsufficientOutputAmount)
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_neverPaysOutPreExistingLp() public {
        uint256 donated = IERC20(pool).balanceOf(seeder) / 1_000;
        vm.prank(seeder);
        IERC20(pool).transfer(address(executor), donated);
        uint256 musdBefore = musd.balanceOf(user);

        vm.prank(user);
        uint256 musdOut = executor.exit(_exitParams(lp, user), _noPermit());

        assertEq(IERC20(pool).balanceOf(address(executor)), donated);
        assertEq(musd.balanceOf(user) - musdBefore, musdOut);
        assertLt(musdOut, 1_000e18); // the donated LP is worth far more than this
    }

    function test_exit_paysRecipientNotCaller() public {
        address recipient = makeAddr("recipient");
        uint256 callerMusdBefore = musd.balanceOf(user);
        vm.prank(user);
        uint256 musdOut = executor.exit(_exitParams(lp, recipient), _noPermit());
        assertEq(musd.balanceOf(recipient), musdOut);
        assertEq(musd.balanceOf(user), callerMusdBefore);
    }
}
