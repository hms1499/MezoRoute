// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

abstract contract OpenLeveragedTest is LeverageBase {
    uint256 internal constant OWN = 0.5e18;
    uint256 internal constant FLASH = 0.3e18;
    uint256 internal constant DEBT = 35_000e18;

    function _openParams(uint256 own, uint256 flash, uint256 debt)
        internal
        view
        returns (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a)
    {
        uint256 maxMusd = (_musdIn(flash) * 101) / 100;
        p = IMezoRouteLeverage.OpenLeveragedParams({
            btcToFlash: flash,
            debtAmount: debt,
            maxMusdToPool: maxMusd,
            minCollateralRatio: 2e18,
            maxDeviationBps: DEV_BPS,
            deadline: block.timestamp + 600
        });
        a = _auth(_sigOpen(user, own + flash, debt));
    }

    function _run(uint256 own, IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a)
        internal
        returns (uint256)
    {
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.deal(user, user.balance + own);
        vm.prank(user);
        return leverage.openLeveraged{value: own}(p, a, permit);
    }

    function test_open_opensTroveWithUserAndFlashedBtc() public {
        (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a) =
            _openParams(OWN, FLASH, DEBT);
        uint256 expected = _musdIn(FLASH);
        uint256 fee = (expected * FEE_BPS) / 10_000;
        uint256 surplus = DEBT - expected - fee;

        vm.expectEmit(true, true, true, true, address(leverage));
        emit IMezoRouteLeverage.OpenedLeveraged(user, OWN, FLASH, DEBT, expected, fee, surplus);
        uint256 musdToPool = _run(OWN, p, a);

        assertEq(musdToPool, expected);
        assertEq(protocol.getTroveColl(user), OWN + FLASH);
        assertEq(musd.balanceOf(user), surplus);
        assertEq(musd.balanceOf(feeRecipient), fee);
        assertEq(user.balance, 0);
        assertEq(musd.balanceOf(address(leverage)), 0);
        assertEq(btc.balanceOf(address(leverage)), 0);
        assertEq(musd.allowance(user, address(leverage)), 0);
    }

    function test_open_existingTroveReverts() public {
        _openTrove(user, 1e18, 30_000e18);
        (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a) =
            _openParams(OWN, FLASH, DEBT);
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.deal(user, OWN);
        vm.prank(user);
        vm.expectRevert("BorrowerOps: Trove is active");
        leverage.openLeveraged{value: OWN}(p, a, permit);
    }

    function test_open_zeroMsgValue() public {
        (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a) =
            _openParams(0, FLASH, DEBT);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.ZeroAmount.selector);
        leverage.openLeveraged(p, a, _noPermit());
    }

    function test_open_minNetDebt() public {
        (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a) =
            _openParams(OWN, 0.01e18, 1_000e18);
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.deal(user, OWN);
        vm.prank(user);
        vm.expectRevert("BorrowerOps: Trove's net debt must be greater than minimum");
        leverage.openLeveraged{value: OWN}(p, a, permit);
    }

    function test_open_capAbove() public {
        IMezoRouteLeverage capped = IMezoRouteLeverage(address(_deploy(FEE_BPS, FLASH - 1, MAX_MUSD_FLASH)));
        (IMezoRouteLeverage.OpenLeveragedParams memory p, IMezoRouteLeverage.TroveAuth memory a) =
            _openParams(OWN, FLASH, DEBT);
        vm.deal(user, OWN);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.AmountAboveCap.selector);
        capped.openLeveraged{value: OWN}(p, a, _noPermit());
    }
}

contract OpenLeveragedTestMusdFirst is OpenLeveragedTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract OpenLeveragedTestBtcFirst is OpenLeveragedTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
