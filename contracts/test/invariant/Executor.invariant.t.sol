// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "../harness/TigrisHarness.sol";
import {ExecutorHandler} from "./ExecutorHandler.sol";

contract ExecutorInvariantTest is TigrisHarness {
    ExecutorHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new ExecutorHandler(executor, musd, btc, address(router), address(factory));
        targetContract(address(handler));
    }

    /// Executor balances are exactly what was donated: nothing user-attributable stays behind
    /// and nothing donated is ever paid out.
    function invariant_executorHoldsOnlyDonations() public view {
        assertEq(musd.balanceOf(address(executor)), handler.donatedMusd());
        assertEq(btc.balanceOf(address(executor)), handler.donatedBtc());
        assertEq(IERC20(pool).balanceOf(address(executor)), handler.donatedLp());
    }

    function invariant_noLingeringAllowances() public view {
        assertEq(musd.allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(router)), 0);
    }
}
