// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

/// @dev Spec 11.1 / 11.8.12: entry is capped per transaction; exit never is.
contract CapTest is TigrisHarness {
    uint256 internal constant CAP = 1_000e18; // the mainnet value

    function setUp() public override {
        super.setUp();
        executor = _deployExecutor(FEE_BPS, CAP);
    }

    function test_maxMusdIn_isTheConstructorValue() public view {
        assertEq(executor.maxMusdIn(), CAP);
    }

    function test_enter_acceptsAmountEqualToCap() public {
        _fund(user, CAP);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(CAP, user);
        vm.prank(user);
        assertGt(executor.enter(p, _noPermit()), 0);
    }

    function test_enter_revertsAboveCap() public {
        _fund(user, CAP + 1);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(CAP + 1, user);
        vm.expectRevert(IMezoRouteExecutor.AmountAboveCap.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_borrowAndEnter_revertsAboveCapBeforeBorrowing() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(CAP + 1, user);
        IMezoRouteExecutor.Borrow memory b = IMezoRouteExecutor.Borrow({
            amount: CAP + 1,
            upperHint: address(0),
            lowerHint: address(0),
            signature: hex"0badc0de",
            deadline: block.timestamp + 600
        });
        vm.expectRevert(IMezoRouteExecutor.AmountAboveCap.selector);
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
        assertEq(bos.lastBorrower(), address(0));
    }

    function test_exit_isNotCapped() public {
        _fund(user, 2 * CAP);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(CAP, user);
        vm.startPrank(user);
        executor.enter(p, _noPermit());
        executor.enter(p, _noPermit());
        uint256 lp = IERC20(pool).balanceOf(user);
        IERC20(pool).approve(address(executor), lp);
        vm.stopPrank();

        IMezoRouteExecutor.ExitParams memory xp = _exitParams(lp, user);
        vm.prank(user);
        uint256 musdOut = executor.exit(xp, _noPermit());

        assertGt(musdOut, CAP); // one exit returns more MUSD than one entry may bring in
        assertEq(IERC20(pool).balanceOf(user), 0);
    }
}
