// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

/// @dev Spec 14: the research round trip (20 MUSD -> 19.988 MUSD through Router zapIn/zapOut on
///      the 4 bps testnet pool) reproduced with the executor's exact primitives instead of zaps.
contract RoundTripTest is TigrisHarness {
    uint256 internal constant AMOUNT = 20e18;

    function setUp() public override {
        super.setUp();
        factory.setCustomFee(pool, 4); // testnet MUSD/BTC pool fee; this test deployed the factory
    }

    function _roundTrip() internal returns (uint256 musdOut) {
        _fund(user, AMOUNT);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(AMOUNT, user);
        vm.startPrank(user);
        uint256 lp = executor.enter(p, _noPermit());
        IERC20(pool).approve(address(executor), lp);
        vm.stopPrank();
        IMezoRouteExecutor.ExitParams memory xp = _exitParams(lp, user);
        vm.prank(user);
        executor.exit(xp, _noPermit());
        return musd.balanceOf(user);
    }

    function test_roundTrip_withoutExecutionFeeMatchesResearchCost() public {
        executor = _deployExecutor(0);
        uint256 musdOut = _roundTrip();
        // Research: 0.06% round-trip cost. Two 4 bps swaps on ~half the amount cost ~0.04%.
        assertGt(musdOut, 19.988e18);
        assertLt(musdOut, AMOUNT);
    }

    function test_roundTrip_executionFeeIsTheOnlyExtraCost() public {
        uint256 musdOut = _roundTrip();
        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(musd.balanceOf(feeRecipient), fee);
        assertGt(musdOut, 19.988e18 - fee);
        assertLt(musdOut, AMOUNT - fee);
    }
}
