// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pool} from "@tigris/Pool.sol";
import {LeverageHarness} from "../harness/LeverageHarness.sol";

abstract contract HarnessTest is LeverageHarness {
    function test_tokenOrder_matchesFlag() public view {
        assertEq(Pool(pool).token0(), btcIsToken0 ? address(btc) : address(musd));
    }

    function test_unifiedBtc_poolSwapMovesNativeBalance() public {
        musd.mint(user, 1_000e18);
        uint256 before = user.balance;
        vm.startPrank(user);
        musd.approve(address(router), 1_000e18);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(1_000e18, 0, _route(address(musd), address(btc)), user, block.timestamp);
        vm.stopPrank();
        assertEq(user.balance - before, amounts[1]);
        assertEq(btc.balanceOf(user), user.balance);
        assertEq(btc.balanceOf(pool), pool.balance);
    }

    function test_mockProtocol_repayBurnsFromCaller() public {
        _openTrove(user, 1e18, 40_000e18);
        bytes memory sig = _sigAdjust(user, 0, 1_000e18, false, 0);
        vm.prank(user);
        vm.expectRevert("BorrowerOps: Caller doesnt have enough mUSD to make repayment");
        protocol.adjustTroveWithSignature(0, 1_000e18, false, address(0), address(0), user, user, sig, block.timestamp);
    }

    function test_mockProtocol_rejectsReusedSignature() public {
        _openTrove(user, 1e18, 40_000e18);
        bytes memory sig = _sigAdjust(user, 0, 1_000e18, true, 0);
        protocol.adjustTroveWithSignature(0, 1_000e18, true, address(0), address(0), user, user, sig, block.timestamp);
        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        protocol.adjustTroveWithSignature(0, 1_000e18, true, address(0), address(0), user, user, sig, block.timestamp);
    }

    function test_mockProtocol_closeBurnsDebtMinusGasComp() public {
        _openTrove(user, 1e18, 40_000e18);
        uint256 debt = protocol.getTroveDebt(user);
        musd.mint(address(this), debt - 200e18);
        bytes memory sig = _sigClose(user);
        uint256 btcBefore = user.balance;
        protocol.closeTroveWithSignature(user, user, sig, block.timestamp);
        assertEq(musd.balanceOf(address(this)), 0);
        assertEq(user.balance - btcBefore, 1e18);
        assertEq(protocol.getTroveDebt(user), 0);
    }
}

contract HarnessTestMusdFirst is HarnessTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract HarnessTestBtcFirst is HarnessTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
