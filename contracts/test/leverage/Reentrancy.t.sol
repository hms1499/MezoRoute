// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {ReentrantMUSD} from "../mocks/ReentrantMUSD.sol";

/// @dev MUSD calls back into the contract during the pool's transfer to it (Unwind) or the pull
///      from the user (Leverage); every entry point must reject the nested call.
abstract contract ReentrancyTest is LeverageBase {
    function _newMusd() internal override returns (MockERC20Permit) {
        return new ReentrantMUSD();
    }

    function setUp() public override {
        super.setUp();
        _openTrove(user, 1e18, 40_000e18);
    }

    function _payloads() internal view returns (bytes[4] memory calls) {
        IMezoRouteLeverage.TroveAuth memory a = _auth("");
        IMezoRouteLeverage.Permit memory none = _noPermit();
        calls[0] = abi.encodeCall(
            IMezoRouteLeverage.unwind, (IMezoRouteLeverage.UnwindParams(1e18, 0, 0, 0, block.timestamp + 600), a, none)
        );
        calls[1] = abi.encodeCall(
            IMezoRouteLeverage.close, (IMezoRouteLeverage.CloseParams(0, 0, block.timestamp + 600), a, none)
        );
        calls[2] = abi.encodeCall(
            IMezoRouteLeverage.leverage,
            (IMezoRouteLeverage.LeverageParams(1e15, 0, 0, 2e18, 0, block.timestamp + 600), a, none)
        );
        calls[3] = abi.encodeCall(
            IMezoRouteLeverage.openLeveraged,
            (IMezoRouteLeverage.OpenLeveragedParams(1e15, 0, 0, 2e18, 0, block.timestamp + 600), a, none)
        );
    }

    function test_unwind_rejectsReentrantCall() public {
        bytes[4] memory calls = _payloads();
        for (uint256 i; i < 4; i++) {
            (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a) = _unwindParams(10_000e18);
            IMezoRouteLeverage.Permit memory permit = _permitFor(address(btc), p.maxBtcToPool);
            ReentrantMUSD(address(musd)).arm(address(leverage), calls[i]);
            vm.prank(user);
            vm.expectRevert("ReentrancyGuard: reentrant call");
            leverage.unwind(p, a, permit);
        }
    }

    function test_leverage_rejectsReentrantCall() public {
        bytes[4] memory calls = _payloads();
        for (uint256 i; i < 4; i++) {
            uint256 maxMusd = (_musdIn(0.1e18) * 101) / 100;
            uint256 pull = maxMusd + (maxMusd * FEE_BPS) / 10_000;
            IMezoRouteLeverage.LeverageParams memory p =
                IMezoRouteLeverage.LeverageParams(0.1e18, pull, maxMusd, 2e18, DEV_BPS, block.timestamp + 600);
            IMezoRouteLeverage.TroveAuth memory a = _auth(_sigAdjust(user, 0, pull, true, 0.1e18));
            IMezoRouteLeverage.Permit memory permit = _permitFor(address(musd), pull);
            ReentrantMUSD(address(musd)).arm(address(leverage), calls[i]);
            vm.prank(user);
            vm.expectRevert("ReentrancyGuard: reentrant call");
            leverage.leverage(p, a, permit);
        }
    }
}

contract ReentrancyTestMusdFirst is ReentrancyTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract ReentrancyTestBtcFirst is ReentrancyTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
