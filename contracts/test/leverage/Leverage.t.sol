// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

abstract contract LeverageTest is LeverageBase {
    uint256 internal constant ADD = 0.2e18;

    function setUp() public override {
        super.setUp();
        _openTrove(user, 1e18, 30_000e18);
    }

    function _leverageParams(uint256 btcToAdd)
        internal
        view
        returns (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a)
    {
        uint256 maxMusd = (_musdIn(btcToAdd) * 101) / 100;
        uint256 fee = (maxMusd * FEE_BPS) / 10_000;
        p = IMezoRouteLeverage.LeverageParams({
            btcToAdd: btcToAdd,
            debtIncrease: maxMusd + fee,
            maxMusdToPool: maxMusd,
            minCollateralRatio: 2e18,
            maxDeviationBps: DEV_BPS,
            deadline: block.timestamp + 600
        });
        a = _auth(_sigAdjust(user, 0, p.debtIncrease, true, btcToAdd));
    }

    function _run(IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a)
        internal
        returns (uint256)
    {
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.prank(user);
        return leverage.leverage(p, a, permit);
    }

    function test_leverage_addsCollateralAndDebt() public {
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        uint256 expected = _musdIn(ADD);
        uint256 fee = (expected * FEE_BPS) / 10_000;
        uint256 surplus = p.debtIncrease - expected - fee;

        vm.expectEmit(true, true, true, true, address(leverage));
        emit IMezoRouteLeverage.Leveraged(user, ADD, p.debtIncrease, expected, fee, surplus);
        uint256 musdToPool = _run(p, a);

        assertEq(musdToPool, expected);
        assertEq(protocol.getTroveColl(user), 1e18 + ADD);
        assertEq(protocol.getTroveDebt(user), 30_000e18 + p.debtIncrease + p.debtIncrease / 1000);
        assertEq(musd.balanceOf(user), surplus);
        assertEq(musd.balanceOf(feeRecipient), fee);
        assertEq(musd.balanceOf(address(leverage)), 0);
        assertEq(btc.balanceOf(address(leverage)), 0);
        assertEq(musd.allowance(user, address(leverage)), 0);
        assertEq(protocol.lastRecipient(), user);
    }

    function test_leverage_minCrEnforced() public {
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        p.minCollateralRatio = 3.5e18; // the result is ≈ 2.4
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.CollateralRatioTooLow.selector);
        leverage.leverage(p, a, permit);
    }

    function test_leverage_minCrBelowFloor() public {
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        p.minCollateralRatio = 1.49e18;
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.MinCrBelowFloor.selector);
        leverage.leverage(p, a, _noPermit());
    }

    function test_leverage_capAbove() public {
        IMezoRouteLeverage capped = IMezoRouteLeverage(address(_deploy(FEE_BPS, ADD - 1, MAX_MUSD_FLASH)));
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.AmountAboveCap.selector);
        capped.leverage(p, a, _noPermit());
    }

    function test_leverage_oracleBound() public {
        priceFeed.setPrice((ORACLE_PRICE * 985) / 1000); // the oracle values BTC 1.5% below the pool
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        p.maxDeviationBps = 200;
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.OracleBoundExceeded.selector);
        leverage.leverage(p, a, permit);

        p.maxDeviationBps = 500;
        _run(p, a);
        assertEq(protocol.getTroveColl(user), 1e18 + ADD);
    }

    function test_leverage_debtIncreaseTooSmall() public {
        (IMezoRouteLeverage.LeverageParams memory p,) = _leverageParams(ADD);
        p.debtIncrease = p.maxMusdToPool; // leaves no room for the fee
        IMezoRouteLeverage.TroveAuth memory a = _auth(_sigAdjust(user, 0, p.debtIncrease, true, ADD));
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.PoolInputAboveMax.selector);
        leverage.leverage(p, a, _noPermit());
    }

    function test_leverage_maxMusdToPoolTooLow() public {
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        p.maxMusdToPool = _musdIn(ADD) - 1;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.debtIncrease);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.PoolInputAboveMax.selector);
        leverage.leverage(p, a, permit);
    }

    function test_leverage_signatureBindsMsgValue() public {
        (IMezoRouteLeverage.LeverageParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _leverageParams(ADD);
        p.btcToAdd = 0.19e18; // the signature was for 0.2 BTC
        uint256 fee = (p.maxMusdToPool * FEE_BPS) / 10_000;
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), p.maxMusdToPool + fee);
        vm.prank(user);
        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        leverage.leverage(p, a, permit);
    }
}

contract LeverageTestMusdFirst is LeverageTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract LeverageTestBtcFirst is LeverageTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
