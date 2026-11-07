// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

abstract contract CloseTest is LeverageBase {
    uint256 internal constant DEBT = 40_000e18;

    function setUp() public override {
        super.setUp();
        _openTrove(user, 1e18, DEBT);
    }

    /// @dev Close params quoted now for the Trove's current debt, with `marginBps` on the BTC.
    function _closeParams(uint256 marginBps)
        internal
        view
        returns (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a)
    {
        uint256 btcNeed = _btcIn(protocol.getTroveDebt(user) - 200e18);
        p = IMezoRouteLeverage.CloseParams({
            maxBtcToPool: (btcNeed * (10_000 + marginBps)) / 10_000,
            maxDeviationBps: DEV_BPS,
            deadline: block.timestamp + 600
        });
        a = _auth(_sigClose(user));
    }

    function _run(IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a)
        internal
        returns (uint256)
    {
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        return leverage.close(p, a, permit);
    }

    function test_close_returnsAllCollateralLessBtcSold() public {
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(100);
        uint256 expected = _btcIn(DEBT - 200e18);

        vm.expectEmit(true, true, true, true, address(leverage));
        emit IMezoRouteLeverage.Closed(user, DEBT - 200e18, 1e18, expected);
        uint256 btcToPool = _run(p, a);

        assertEq(btcToPool, expected);
        assertEq(protocol.getTroveDebt(user), 0);
        assertEq(btc.balanceOf(user), 1e18 - btcToPool);
        assertEq(musd.balanceOf(user), 0);
        assertEq(musd.balanceOf(address(leverage)), 0);
        assertEq(btc.balanceOf(address(leverage)), 0);
        assertEq(btc.allowance(user, address(leverage)), 0);
        assertEq(protocol.lastRecipient(), user);
    }

    function test_close_paysExactAfterInterestAccrues() public {
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(100);
        protocol.accrue(user, 5e18);
        uint256 expected = _btcIn(DEBT + 5e18 - 200e18);
        uint256 btcToPool = _run(p, a);
        assertEq(btcToPool, expected);
        assertEq(btc.balanceOf(user), 1e18 - expected);
    }

    function test_close_capAbove() public {
        IMezoRouteLeverage capped = IMezoRouteLeverage(address(_deploy(FEE_BPS, MAX_BTC_FLASH, DEBT - 200e18 - 1)));
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(100);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.AmountAboveCap.selector);
        capped.close(p, a, _noPermit());
    }

    function test_close_recoveryModeReverts() public {
        protocol.setRecoveryMode(true);
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(100);
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert("BorrowerOps: Operation not permitted during Recovery Mode");
        leverage.close(p, a, permit);
    }

    function test_close_oracleBound() public {
        priceFeed.setPrice((ORACLE_PRICE * 106) / 100);
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(100);
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.OracleBoundExceeded.selector);
        leverage.close(p, a, permit);
    }

    function test_close_maxBtcToPoolTooLow() public {
        (IMezoRouteLeverage.CloseParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _closeParams(0);
        protocol.accrue(user, 5e18);
        IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
        vm.prank(user);
        vm.expectRevert(IMezoRouteLeverage.PoolInputAboveMax.selector);
        leverage.close(p, a, permit);
    }

    function test_close_noTroveReverts() public {
        address stranger = makeAddr("stranger");
        IMezoRouteLeverage.CloseParams memory p = IMezoRouteLeverage.CloseParams({
            maxBtcToPool: 1e18, maxDeviationBps: DEV_BPS, deadline: block.timestamp + 600
        });
        IMezoRouteLeverage.TroveAuth memory a = _auth(_sigClose(stranger));
        vm.prank(stranger);
        vm.expectRevert(IMezoRouteLeverage.ZeroAmount.selector);
        leverage.close(p, a, _noPermit());
    }
}

contract CloseTestMusdFirst is CloseTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract CloseTestBtcFirst is CloseTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
