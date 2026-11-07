// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageBase} from "../leverage/LeverageBase.sol";
import {LeverageHandler} from "./LeverageHandler.sol";

abstract contract LeverageInvariantTest is LeverageBase {
    LeverageHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new LeverageHandler(leverage, musd, btc, protocol, priceFeed, router, pool, address(factory));
        for (uint256 i; i < 3; i++) {
            _openTrove(handler.actor(i), 1e18, 30_000e18 + i * 5_000e18);
        }
        targetContract(address(handler));
    }

    /// The contract's balances are exactly what was donated: nothing from any action stays behind and
    /// nothing donated is ever paid out.
    function invariant_holdsOnlyDonations() public view {
        assertEq(musd.balanceOf(address(leverage)), handler.donatedMusd());
        assertEq(btc.balanceOf(address(leverage)), handler.donatedBtc());
    }

    /// Every successful action named the caller as borrower and recipient, came from the contract, and
    /// left no allowance from the caller to the contract.
    function invariant_recipientIsCallerAndNoAllowanceLeft() public view {
        assertEq(handler.violations(), 0);
    }

    /// No operation is left in flight: `_op` (slot 1) and `_result` (slot 2) are back to zero.
    function invariant_opIdle() public view {
        assertEq(uint256(vm.load(address(leverage), bytes32(uint256(1)))), 0);
        assertEq(uint256(vm.load(address(leverage), bytes32(uint256(2)))), 0);
    }

    /// The contract never owns a Trove.
    function invariant_ownsNoTrove() public view {
        assertEq(protocol.getTroveDebt(address(leverage)), 0);
    }

    function afterInvariant() public view {
        // The run must exercise real actions, not only reverts.
        assertGt(handler.successes(), 0);
    }
}

contract LeverageInvariantMusdFirst is LeverageInvariantTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract LeverageInvariantBtcFirst is LeverageInvariantTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
