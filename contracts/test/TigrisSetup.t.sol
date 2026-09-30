// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {ITigrisRouter} from "../src/interfaces/external/ITigrisRouter.sol";
import {ITigrisQuoter} from "./harness/ITigrisQuoter.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";
import {MockFactoryRegistry} from "./mocks/MockFactoryRegistry.sol";

/// @dev Proves the pinned Tigris sources compile under our toolchain and behave like the live pool.
contract TigrisSetupTest is Test {
    function test_realTigrisContractsDeploySeedAndQuote() public {
        MockERC20Permit musd = new MockERC20Permit("Mezo USD", "MUSD");
        MockERC20Permit btc = new MockERC20Permit("BTC", "BTC");
        PoolFactory factory = new PoolFactory(address(new Pool()));
        Router router = new Router(address(0), address(new MockFactoryRegistry()), address(factory));
        address pool = factory.createPool(address(musd), address(btc), false);

        assertEq(ITigrisRouter(address(router)).poolFor(address(musd), address(btc), false, address(factory)), pool);

        musd.mint(address(this), 1_000_000e18);
        btc.mint(address(this), 10e18);
        musd.approve(address(router), type(uint256).max);
        btc.approve(address(router), type(uint256).max);
        (,, uint256 liquidity) = ITigrisRouter(address(router))
            .addLiquidity(address(musd), address(btc), false, 1_000_000e18, 10e18, 0, 0, address(this), block.timestamp);
        assertGt(liquidity, 0);

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route(address(musd), address(btc), false, address(factory));
        uint256 btcOut = ITigrisQuoter(address(router)).getAmountsOut(1_000e18, routes)[1];
        // 1,000 MUSD at 100,000 MUSD/BTC is 0.01 BTC before the 0.3% fee and price impact.
        assertGt(btcOut, 0.0099e18);
        assertLt(btcOut, 0.01e18);
    }
}
