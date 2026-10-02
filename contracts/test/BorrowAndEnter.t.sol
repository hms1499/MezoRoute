// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "forge-std/Vm.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract BorrowAndEnterTest is TigrisHarness {
    bytes internal constant SIG = hex"0badc0de";

    function _borrow(uint256 amount) internal view returns (IMezoRouteExecutor.Borrow memory) {
        return IMezoRouteExecutor.Borrow({
            amount: amount,
            upperHint: address(0),
            lowerHint: address(0),
            signature: SIG,
            deadline: block.timestamp + 600
        });
    }

    function setUp() public override {
        super.setUp();
        vm.prank(user);
        musd.approve(address(executor), type(uint256).max);
    }

    function test_borrowAndEnter_borrowsToCallerThenDeposits() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        uint256 lp = executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);

        assertGt(lp, 0);
        assertEq(IERC20(pool).balanceOf(user), lp);
        assertEq(bos.lastBorrower(), user);
        assertEq(bos.lastRecipient(), user); // never the executor
        assertEq(musd.balanceOf(address(executor)), 0);
    }

    function test_borrowAndEnter_revertsWhenRecipientIsNotCaller() public {
        address mallory = makeAddr("mallory");
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, mallory);
        vm.expectRevert(IMezoRouteExecutor.NotBorrower.selector);
        vm.prank(user);
        executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);
    }

    function test_borrowAndEnter_revertsOnAmountMismatch() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.expectRevert(IMezoRouteExecutor.BorrowAmountMismatch.selector);
        vm.prank(user);
        executor.borrowAndEnter(_borrow(999e18), _noPermit(), p);
    }

    function test_borrowAndEnter_frontRunLeavesMusdWithUser() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Borrow memory b = _borrow(1_000e18);

        // Attacker replays the signature straight to Mezo with the signed recipient (the user).
        bos.withdrawMUSDWithSignature(b.amount, address(0), address(0), user, user, b.signature, b.deadline);

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);

        assertEq(musd.balanceOf(user), 1_000e18);
        assertEq(musd.balanceOf(address(executor)), 0);
    }

    function test_borrowAndEnter_emitsBorrowedAmount() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.recordLogs();
        vm.prank(user);
        executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);
        Vm.Log[] memory logs = vm.getRecordedLogs(); // consumes the recorded logs
        Vm.Log memory entered = logs[logs.length - 1];
        assertEq(entered.topics[0], IMezoRouteExecutor.Entered.selector);
        (uint256 musdBorrowed) = abi.decode(entered.data, (uint256));
        assertEq(musdBorrowed, 1_000e18);
    }

    function test_borrowAndEnter_revertsWhenExpiredBeforeBorrowing() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Borrow memory b = _borrow(1_000e18);
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutor.Expired.selector);
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
        assertEq(bos.lastBorrower(), address(0));
    }

    function test_borrowAndEnter_revertsWhenBorrowSignatureExpired() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Borrow memory b = _borrow(1_000e18);
        b.deadline = block.timestamp - 1;
        vm.expectRevert("Signature expired");
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
    }

    function test_borrowAndEnter_revertsOnReplayedSignature() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Borrow memory b = _borrow(1_000e18);
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);

        p = _enterParams(1_000e18, user);
        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);
    }

    function test_borrowAndEnter_chargesExecutionFee() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);
        assertEq(musd.balanceOf(feeRecipient), 1e18); // 10 bps of the borrowed 1,000 MUSD
    }
}
