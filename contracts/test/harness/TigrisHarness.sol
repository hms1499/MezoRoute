// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {MezoRouteExecutor} from "../../src/MezoRouteExecutor.sol";
import {IMezoRouteExecutor} from "../../src/interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockFactoryRegistry} from "../mocks/MockFactoryRegistry.sol";
import {MockBorrowerOperationsSignatures} from "../mocks/MockBorrowerOperationsSignatures.sol";
import {ITigrisQuoter} from "./ITigrisQuoter.sol";

/// @dev Deploys the real Tigris Pool, PoolFactory and Router (pinned commit) with mock MUSD/BTC.
///      Mezo's BTC token is backed by a chain precompile, so it cannot be used on a local fork.
abstract contract TigrisHarness is Test {
    uint256 internal constant FEE_BPS = 10;
    uint256 internal constant SEED_MUSD = 1_000_000e18;
    uint256 internal constant SEED_BTC = 10e18; // 1 BTC = 100,000 MUSD

    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    PoolFactory internal factory;
    Router internal router;
    address internal pool;
    MockBorrowerOperationsSignatures internal bos;
    MezoRouteExecutor internal executor;

    address internal feeRecipient = makeAddr("feeRecipient");
    address internal seeder = makeAddr("seeder");
    uint256 internal userKey = 0xA11CE;
    address internal user = vm.addr(userKey);

    function setUp() public virtual {
        musd = _newMusd();
        btc = new MockERC20Permit("BTC", "BTC");
        factory = new PoolFactory(address(new Pool()));
        router = new Router(address(0), address(new MockFactoryRegistry()), address(factory));
        pool = factory.createPool(address(musd), address(btc), false);
        bos = new MockBorrowerOperationsSignatures(musd);

        musd.mint(seeder, SEED_MUSD);
        btc.mint(seeder, SEED_BTC);
        vm.startPrank(seeder);
        musd.approve(address(router), SEED_MUSD);
        btc.approve(address(router), SEED_BTC);
        router.addLiquidity(address(musd), address(btc), false, SEED_MUSD, SEED_BTC, 0, 0, seeder, block.timestamp);
        vm.stopPrank();

        executor = _deployExecutor(FEE_BPS);
    }

    function _newMusd() internal virtual returns (MockERC20Permit) {
        return new MockERC20Permit("Mezo USD", "MUSD");
    }

    function _deployExecutor(uint256 feeBps) internal returns (MezoRouteExecutor) {
        return new MezoRouteExecutor(
            address(musd), address(btc), address(router), address(factory), pool, address(bos), feeBps, feeRecipient
        );
    }

    function _noPermit() internal pure returns (IMezoRouteExecutor.Permit memory) {
        return IMezoRouteExecutor.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }

    /// @dev Swaps half of the post-fee amount; minimums at 1% below the pre-trade quote.
    ///      Makes external calls, so build params BEFORE `vm.prank`.
    function _enterParams(uint256 musdIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutor.EnterParams memory p)
    {
        uint256 net = musdIn - (musdIn * executor.feeBps()) / 10_000;
        uint256 musdToSwap = net / 2;
        uint256 btcOut = _quoteSwap(address(musd), address(btc), musdToSwap);
        p = IMezoRouteExecutor.EnterParams({
            musdIn: musdIn,
            musdToSwap: musdToSwap,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient
        });
    }

    function _exitParams(uint256 liquidityIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutor.ExitParams memory p)
    {
        p = IMezoRouteExecutor.ExitParams({
            liquidityIn: liquidityIn,
            minMusdRemoved: 0,
            minBtcRemoved: 0,
            minMusdFromSwap: 0,
            minMusdOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient
        });
    }

    function _quoteSwap(address from, address to, uint256 amountIn) internal view returns (uint256) {
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: address(factory)});
        return ITigrisQuoter(address(router)).getAmountsOut(amountIn, routes)[1];
    }

    function _fund(address who, uint256 amount) internal {
        musd.mint(who, amount);
        vm.prank(who);
        musd.approve(address(executor), type(uint256).max);
    }
}
