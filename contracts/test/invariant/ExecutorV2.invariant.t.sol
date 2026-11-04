// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarnessV2} from "../harness/TigrisHarnessV2.sol";
import {ExecutorV2Handler} from "./ExecutorV2Handler.sol";

contract ExecutorV2InvariantTest is TigrisHarnessV2 {
    uint256 internal constant DONATED_MEZO = 7e18;
    ExecutorV2Handler internal handler;

    function setUp() public override {
        super.setUp();
        mezo.mint(address(executor), DONATED_MEZO);
        handler = new ExecutorV2Handler(executor, musd, btc, mezo, voter, gauge, address(router), address(factory));
        targetContract(address(handler));
    }

    /// Executor balances are exactly what was donated: nothing user-attributable stays behind
    /// (staked or not) and nothing donated is ever paid out.
    function invariant_executorHoldsOnlyDonations() public view {
        assertEq(musd.balanceOf(address(executor)), handler.donatedMusd());
        assertEq(btc.balanceOf(address(executor)), handler.donatedBtc());
        assertEq(IERC20(pool).balanceOf(address(executor)), handler.donatedLp());
    }

    function invariant_noLingeringAllowances() public view {
        assertEq(musd.allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(router)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(gauge)), 0);
    }

    /// The executor never moves MEZO, whether or not the gauge pays rewards.
    function invariant_mezoUnchanged() public view {
        assertEq(mezo.balanceOf(address(executor)), DONATED_MEZO);
        assertEq(mezo.allowance(address(executor), address(gauge)), 0);
    }

    /// Staked LP is credited only to the actors who entered: the executor holds no gauge balance
    /// and every staked LP is accounted to an actor.
    function invariant_stakeCreditedOnlyToActors() public view {
        assertEq(gauge.balanceOf(address(executor)), 0);
        uint256 sum;
        for (uint256 i; i < handler.actorsLength(); i++) {
            sum += gauge.balanceOf(handler.actorAt(i));
        }
        assertEq(gauge.totalSupply(), sum);
    }
}
