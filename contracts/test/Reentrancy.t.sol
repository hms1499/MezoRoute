// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";
import {ReentrantMUSD} from "./mocks/ReentrantMUSD.sol";

contract ReentrancyTest is TigrisHarness {
    function _newMusd() internal override returns (MockERC20Permit) {
        return new ReentrantMUSD();
    }

    function test_enter_rejectsReentrantCall() public {
        _fund(user, 2_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        ReentrantMUSD(address(musd)).arm(address(executor), abi.encodeCall(IMezoRouteExecutor.enter, (p, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.enter(p, _noPermit());
    }
}
