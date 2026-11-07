// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pool} from "@tigris/Pool.sol";
import {LeverageBase} from "./LeverageBase.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

/// @dev Starts a flash swap of its own with the leverage contract as `to`, so the pool calls
///      `leverage.hook(sender = this, ...)`.
contract ForeignSwapper {
    function run(address pool, address to, uint256 amount0Out, uint256 amount1Out, bytes calldata data) external {
        Pool(pool).swap(amount0Out, amount1Out, to, data);
    }
}

abstract contract HookTest is LeverageBase {
    function test_hook_directCallReverts() public {
        vm.expectRevert(IMezoRouteLeverage.UnauthorizedHook.selector);
        leverage.hook(address(leverage), 1, 0, abi.encode(uint256(1)));
    }

    function test_hook_poolCallForAnotherSenderReverts() public {
        ForeignSwapper swapper = new ForeignSwapper();
        vm.expectRevert(IMezoRouteLeverage.UnauthorizedHook.selector);
        swapper.run(pool, address(leverage), 1e15, 0, abi.encode(uint256(1)));
    }

    function test_hook_poolCallPretendingToBeTheContractReverts() public {
        // The pool passes its own msg.sender as `sender`; outside an operation `_op` is 0.
        vm.prank(address(leverage));
        vm.expectRevert(IMezoRouteLeverage.UnauthorizedHook.selector);
        Pool(pool).swap(1e15, 0, address(leverage), abi.encode(uint256(1)));
    }
}

contract HookTestMusdFirst is HookTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract HookTestBtcFirst is HookTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
