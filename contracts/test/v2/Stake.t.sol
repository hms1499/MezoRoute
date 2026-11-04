// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "forge-std/Vm.sol";
import {IGauge} from "@tigris/interfaces/IGauge.sol";
import {Gauge} from "@tigris/gauges/Gauge.sol";
import {TigrisHarnessV2} from "../harness/TigrisHarnessV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {MockMiscreditingGauge} from "../mocks/MockMiscreditingGauge.sol";

/// @dev Staking through the real Tigris `Gauge`: LP is credited to the recipient inside the gauge,
///      the executor keeps no LP and no allowance, and MEZO never passes through it.
contract StakeV2Test is TigrisHarnessV2 {
    function setUp() public override {
        super.setUp();
        _fund(user, 10_000e18);
    }

    function _enterStaked(address caller, address recipient) internal returns (uint256 lp) {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, recipient, true);
        vm.prank(caller);
        lp = executor.enter(p, _noPermit());
    }

    function test_enter_stake_creditsRecipientAndLeavesNothing() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        assertGt(lp, 0);
        assertEq(gauge.balanceOf(user), lp);
        assertEq(gauge.totalSupply(), lp);
        assertEq(IERC20(pool).balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(gauge)), 0);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool staked;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(executor) && logs[i].topics[0] == IMezoRouteExecutorV2.Staked.selector) {
                assertEq(address(uint160(uint256(logs[i].topics[1]))), user);
                assertEq(abi.decode(logs[i].data, (uint256)), lp);
                staked = true;
            }
        }
        assertTrue(staked);
    }

    function test_enter_noStake_keepsLpInWallet() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, false);
        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        assertEq(IERC20(pool).balanceOf(user), lp);
        assertEq(gauge.balanceOf(user), 0);
    }

    function test_borrowAndEnter_stake_creditsCaller() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        IMezoRouteExecutorV2.Borrow memory b = IMezoRouteExecutorV2.Borrow({
            amount: 1_000e18,
            upperHint: address(0),
            lowerHint: address(0),
            signature: hex"0badc0de",
            deadline: block.timestamp + 600
        });
        vm.prank(user);
        uint256 lp = executor.borrowAndEnter(b, _noPermit(), p);

        assertGt(lp, 0);
        assertEq(gauge.balanceOf(user), lp);
        assertEq(IERC20(pool).balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(gauge)), 0);
    }

    function test_enter_stake_recipientCredited_notCaller() public {
        address recipient = makeAddr("recipient");
        uint256 lp = _enterStaked(user, recipient);

        assertEq(gauge.balanceOf(recipient), lp);
        assertEq(gauge.balanceOf(user), 0);
        assertEq(IERC20(pool).balanceOf(user), 0);
    }

    function test_enter_stake_revertsOnKilledGauge() public {
        voter.setAlive(false);

        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        vm.expectRevert(IGauge.NotAlive.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());

        p.stake = false;
        vm.prank(user);
        assertGt(executor.enter(p, _noPermit()), 0);
    }

    function test_enter_stake_revertsWithoutGauge() public {
        executor = _deployExecutor(FEE_BPS, MAX_MUSD_IN, address(0));
        _fund(user, 10_000e18);

        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        vm.expectRevert(IMezoRouteExecutorV2.GaugeUnavailable.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());

        p.stake = false;
        vm.prank(user);
        assertGt(executor.enter(p, _noPermit()), 0);
    }

    function test_constructor_revertsOnGaugeForOtherToken() public {
        Gauge other = new Gauge(address(0), address(musd), address(0), address(mezo), address(voter), false);
        vm.expectRevert(IMezoRouteExecutorV2.GaugeMismatch.selector);
        _deployExecutor(FEE_BPS, MAX_MUSD_IN, address(other));
    }

    function test_enter_revertsWhenRecipientIsGauge() public {
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, address(gauge), true);
        vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());

        p.stake = false;
        vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_stake_ignoresPreExistingExecutorLp() public {
        uint256 donation = 1e18;
        vm.prank(seeder);
        IERC20(pool).transfer(address(executor), donation);

        uint256 lp = _enterStaked(user, user);

        assertEq(gauge.balanceOf(user), lp);
        assertEq(IERC20(pool).balanceOf(address(executor)), donation);
        assertEq(IERC20(pool).balanceOf(user), 0);
    }

    function test_roundTrip_stake_claim_unstake_exit() public {
        uint256 lp = _enterStaked(user, user);

        voter.notify(address(gauge), 7_000e18);
        vm.warp(block.timestamp + 1 days);

        assertGt(gauge.earned(user), 0);
        vm.prank(user);
        gauge.getReward(user);
        uint256 claimed = mezo.balanceOf(user);
        assertGt(claimed, 0);

        // Only the owner (or the voter) may pull rewards for an account.
        vm.expectRevert(IGauge.NotAuthorized.selector);
        vm.prank(makeAddr("mallory"));
        gauge.getReward(user);

        vm.startPrank(user);
        gauge.withdraw(lp);
        IERC20(pool).approve(address(executor), lp);
        vm.stopPrank();
        assertEq(IERC20(pool).balanceOf(user), lp);

        IMezoRouteExecutorV2.ExitParams memory xp = _exitParams(lp, user);
        uint256 musdBefore = musd.balanceOf(user);
        vm.prank(user);
        uint256 musdOut = executor.exit(xp, _noPermit());

        assertGt(musdOut, 0);
        assertEq(musd.balanceOf(user), musdBefore + musdOut);
        assertEq(mezo.balanceOf(user), claimed); // unstaking and exiting leave MEZO untouched
    }

    function test_executorNeverTouchesMezo() public {
        uint256 lp = _enterStaked(user, user);
        voter.notify(address(gauge), 7_000e18);
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(user);
        gauge.getReward(user);
        gauge.withdraw(lp);
        IERC20(pool).approve(address(executor), lp);
        executor.exit(_exitParams(lp, user), _noPermit());
        vm.stopPrank();
        assertEq(mezo.balanceOf(address(executor)), 0);

        mezo.mint(address(executor), 1e18);
        _enterStaked(user, user);
        assertEq(mezo.balanceOf(address(executor)), 1e18);
    }

    function test_enter_stake_revertsWhenGaugeCreditsLessThanDeposited() public {
        executor = _deployExecutor(FEE_BPS, MAX_MUSD_IN, address(new MockMiscreditingGauge(pool)));
        _fund(user, 1_000e18);

        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        vm.expectRevert(IMezoRouteExecutorV2.StakeNotCredited.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_exit_revertsWhenRecipientIsGauge() public {
        uint256 lp = _enterStaked(user, user);
        vm.startPrank(user);
        gauge.withdraw(lp);
        IERC20(pool).approve(address(executor), lp);
        vm.stopPrank();

        IMezoRouteExecutorV2.ExitParams memory xp = _exitParams(lp, address(gauge));
        vm.expectRevert(IMezoRouteExecutorV2.InvalidRecipient.selector);
        vm.prank(user);
        executor.exit(xp, _noPermit());
    }

    function test_enter_stake_refundsGoToRecipientAndExecutorEndsEmpty() public {
        address recipient = makeAddr("recipient");
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, recipient, true);

        vm.recordLogs();
        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 musdRefund;
        uint256 btcRefund;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(executor) && logs[i].topics[0] == IMezoRouteExecutorV2.Entered.selector) {
                (,,,,,,,, musdRefund, btcRefund) = abi.decode(
                    logs[i].data,
                    (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
                );
            }
        }
        assertGt(musdRefund + btcRefund, 0);
        assertEq(musd.balanceOf(recipient), musdRefund);
        assertEq(btc.balanceOf(recipient), btcRefund);
        assertEq(gauge.balanceOf(recipient), lp);
        assertEq(musd.balanceOf(user), 9_000e18);
        assertEq(btc.balanceOf(user), 0);
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
    }

    function _borrow() internal view returns (IMezoRouteExecutorV2.Borrow memory) {
        return IMezoRouteExecutorV2.Borrow({
            amount: 1_000e18,
            upperHint: address(0),
            lowerHint: address(0),
            signature: hex"0badc0de",
            deadline: block.timestamp + 600
        });
    }

    function test_borrowAndEnter_stake_revertsOnKilledGauge() public {
        voter.setAlive(false);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        IMezoRouteExecutorV2.Borrow memory b = _borrow();
        vm.expectRevert(IGauge.NotAlive.selector);
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);

        p.stake = false;
        vm.prank(user);
        assertGt(executor.borrowAndEnter(b, _noPermit(), p), 0);
    }

    function test_borrowAndEnter_stake_revertsWithoutGauge() public {
        executor = _deployExecutor(FEE_BPS, MAX_MUSD_IN, address(0));
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user, true);
        IMezoRouteExecutorV2.Borrow memory b = _borrow();
        vm.expectRevert(IMezoRouteExecutorV2.GaugeUnavailable.selector);
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
        assertEq(bos.lastBorrower(), address(0)); // validated before borrowing
    }
}
