// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {MezoRouteExecutor} from "../src/MezoRouteExecutor.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract ConstructorTest is TigrisHarness {
    /// addLiquidity/removeLiquidity always use the Router's default factory, so a pool from
    /// another factory would swap on one pool and add liquidity to a different one.
    function test_constructor_revertsWhenFactoryIsNotRouterDefault() public {
        PoolFactory otherFactory = new PoolFactory(address(new Pool()));
        address otherPool = otherFactory.createPool(address(musd), address(btc), false);

        vm.expectRevert(IMezoRouteExecutor.FactoryMismatch.selector);
        new MezoRouteExecutor(
            address(musd),
            address(btc),
            address(router),
            address(otherFactory),
            otherPool,
            address(bos),
            FEE_BPS,
            feeRecipient,
            MAX_MUSD_IN
        );
    }

    function test_constructor_revertsOnZeroCap() public {
        vm.expectRevert(IMezoRouteExecutor.ZeroAmount.selector);
        _deployExecutor(FEE_BPS, 0);
    }

    function test_constructor_acceptsMaxFee() public {
        assertEq(_deployExecutor(50, MAX_MUSD_IN).feeBps(), 50);
    }

    function test_constructor_revertsOnZeroFeeRecipient() public {
        vm.expectRevert(IMezoRouteExecutor.ZeroAddress.selector);
        new MezoRouteExecutor(
            address(musd), address(btc), address(router), address(factory), pool, address(bos), FEE_BPS, address(0), 1
        );
    }
}
