// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarnessV2} from "../harness/TigrisHarnessV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {ReentrantMUSD} from "../mocks/ReentrantMUSD.sol";

contract ReentrancyV2Test is TigrisHarnessV2 {
    function _newMusd() internal override returns (MockERC20Permit) {
        return new ReentrantMUSD();
    }

    function test_enter_rejectsReentrantCall() public {
        _fund(user, 2_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        ReentrantMUSD(address(musd))
            .arm(address(executor), abi.encodeCall(IMezoRouteExecutorV2.enter, (p, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_borrowAndEnter_rejectsReentrantCall() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutorV2.Borrow memory b = IMezoRouteExecutorV2.Borrow({
            amount: 1_000e18,
            upperHint: address(0),
            lowerHint: address(0),
            signature: hex"0badc0de",
            deadline: block.timestamp + 600
        });
        ReentrantMUSD(address(musd))
            .arm(address(executor), abi.encodeCall(IMezoRouteExecutorV2.enter, (p, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
    }

    function test_exit_rejectsReentrantCall() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutorV2.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());
        vm.prank(user);
        IERC20(pool).approve(address(executor), lp);
        IMezoRouteExecutorV2.ExitParams memory xp = _exitParams(lp, user);
        // Fires on the pool's MUSD transfer to the executor inside removeLiquidity.
        ReentrantMUSD(address(musd))
            .arm(address(executor), abi.encodeCall(IMezoRouteExecutorV2.exit, (xp, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.exit(xp, _noPermit());
    }
}
