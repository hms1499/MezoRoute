// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

abstract contract UnwindTest is LeverageBase {
    uint256 internal constant REPAY = 10_000e18;

    function setUp() public override {
        super.setUp();
        _openTrove(user, 1e18, 40_000e18);
    }

    function _run(IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a)
        internal
        returns (uint256)
    {
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        return leverage.unwind(p, a, permit);
    }

    function test_unwind_repaysAndReturnsRemainder() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        uint256 expected = _btcIn(REPAY);

        vm.expectEmit(true, true, true, true, address(leverage));
        emit IMezoRouteLeverage.Unwound(user, REPAY, p.collWithdrawal, expected);
        uint256 btcToPool = _run(p, a);

        assertEq(btcToPool, expected);
        assertEq(protocol.getTroveDebt(user), 40_000e18 - REPAY);
        assertEq(protocol.getTroveColl(user), 1e18 - p.collWithdrawal);
        assertEq(btc.balanceOf(user), p.collWithdrawal - btcToPool);
        assertEq(musd.balanceOf(user), 0);
        assertEq(musd.balanceOf(address(leverage)), 0);
        assertEq(btc.balanceOf(address(leverage)), 0);
        assertEq(btc.allowance(user, address(leverage)), 0);
        assertEq(protocol.lastRecipient(), user);
        assertEq(protocol.lastBorrower(), user);
    }

    function test_unwind_noMusdInWallet() public {
        assertEq(musd.balanceOf(user), 0);
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        _run(p, a);
        assertEq(protocol.getTroveDebt(user), 30_000e18);
    }

    function test_unwind_capAbove() public {
        IMezoRouteLeverage capped = IMezoRouteLeverage(address(_deploy(FEE_BPS, MAX_BTC_FLASH, REPAY - 1)));
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.AmountAboveCap.selector);
        capped.unwind(p, a, _noPermit());
    }

    function test_unwind_zeroAmount() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        p.debtToRepay = 0;
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.ZeroAmount.selector);
        leverage.unwind(p, a, _noPermit());
    }

    function test_unwind_expired() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        p.deadline = block.timestamp - 1;
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.Expired.selector);
        leverage.unwind(p, a, _noPermit());
    }

    function test_unwind_deviationAboveCap() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        p.maxDeviationBps = 1_001;
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.DeviationTooHigh.selector);
        leverage.unwind(p, a, _noPermit());
    }

    function test_unwind_oracleBound() public {
        priceFeed.setPrice((ORACLE_PRICE * 103) / 100); // the oracle values BTC 3% above the pool
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        p.maxDeviationBps = 200;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.OracleBoundExceeded.selector);
        leverage.unwind(p, a, permit);

        p.maxDeviationBps = 500;
        _run(p, a);
        assertEq(protocol.getTroveDebt(user), 30_000e18);
    }

    function test_unwind_maxBtcToPoolTooLow() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        p.maxBtcToPool = _btcIn(REPAY) - 1;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.PoolInputAboveMax.selector);
        leverage.unwind(p, a, permit);
    }

    function test_unwind_recoveryModeReverts() public {
        protocol.setRecoveryMode(true);
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert("BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
        leverage.unwind(p, a, permit);
    }

    function test_unwind_permitAlreadyUsedFallsBackToAllowance() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        btc.permit(user, address(leverage), permit.value, permit.deadline, permit.v, permit.r, permit.s); // front-run
        vm.prank(user);
        leverage.unwind(p, a, permit);
        assertEq(protocol.getTroveDebt(user), 30_000e18);
        assertEq(btc.allowance(user, address(leverage)), 0);
    }

    function test_unwind_noPermitNoAllowanceReverts() public {
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        vm.prank(user);
        vm.expectRevert("ERC20: insufficient allowance");
        leverage.unwind(p, a, _noPermit());
    }

    function test_unwind_preExistingBalancesUntouched() public {
        musd.mint(address(leverage), 1_000e18);
        btc.mint(address(leverage), 0.5e18);
        (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(REPAY);
        uint256 btcToPool = _run(p, a);
        assertEq(musd.balanceOf(address(leverage)), 1_000e18);
        assertEq(btc.balanceOf(address(leverage)), 0.5e18);
        assertEq(btc.balanceOf(user), p.collWithdrawal - btcToPool);
    }
}

contract UnwindTestMusdFirst is UnwindTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract UnwindTestBtcFirst is UnwindTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
