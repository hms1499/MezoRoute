// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {Gauge} from "@tigris/gauges/Gauge.sol";
import {MezoRouteExecutorV2} from "../../src/MezoRouteExecutorV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockFactoryRegistry} from "../mocks/MockFactoryRegistry.sol";
import {MockVoter} from "../mocks/MockVoter.sol";
import {MockBorrowerOperationsSignatures} from "../mocks/MockBorrowerOperationsSignatures.sol";
import {ITigrisQuoter} from "./ITigrisQuoter.sol";

/// @dev Deploys the real Tigris Pool, PoolFactory and Router (pinned commit) with mock MUSD/BTC.
///      Mezo's BTC token is backed by a chain precompile, so it cannot be used on a local fork.
abstract contract TigrisHarnessV2 is Test {
    uint256 internal constant FEE_BPS = 10;
    uint256 internal constant SEED_MUSD = 1_000_000e18;
    uint256 internal constant SEED_BTC = 10e18; // 1 BTC = 100,000 MUSD
    uint256 internal constant MAX_MUSD_IN = 1_000_000e18; // the testnet cap
    uint256 internal constant MAX_BTC_IN = 12e18; // the testnet BTC cap

    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    PoolFactory internal factory;
    Router internal router;
    address internal pool;
    MockBorrowerOperationsSignatures internal bos;
    MezoRouteExecutorV2 internal executor;
    MockERC20Permit internal mezo;
    MockVoter internal voter;
    /// @dev The real Tigris `Gauge`. `isPool` is false so notifying does not forward pool fees to a
    ///      fees voting reward, which this harness does not model; staking and emissions are unaffected.
    Gauge internal gauge;

    address internal feeRecipient = makeAddr("feeRecipient");
    address internal seeder = makeAddr("seeder");
    uint256 internal userKey = 0xA11CE;
    address internal user = vm.addr(userKey);

    function setUp() public virtual {
        musd = _newMusd();
        btc = _newBtc();
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

        mezo = new MockERC20Permit("MEZO", "MEZO");
        voter = new MockVoter(mezo);
        gauge = new Gauge(address(0), pool, address(0), address(mezo), address(voter), false);
        mezo.mint(address(voter), 1_000_000e18);

        executor = _deployExecutor(FEE_BPS);
    }

    function _newMusd() internal virtual returns (MockERC20Permit) {
        return new MockERC20Permit("Mezo USD", "MUSD");
    }

    function _newBtc() internal virtual returns (MockERC20Permit) {
        return new MockERC20Permit("BTC", "BTC");
    }

    function _deployExecutor(uint256 feeBps) internal returns (MezoRouteExecutorV2) {
        return _deployExecutor(feeBps, MAX_MUSD_IN);
    }

    function _deployExecutor(uint256 feeBps, uint256 maxMusdIn) internal returns (MezoRouteExecutorV2) {
        return _deployExecutor(feeBps, maxMusdIn, address(gauge));
    }

    function _deployExecutor(uint256 feeBps, uint256 maxMusdIn, address gauge_) internal returns (MezoRouteExecutorV2) {
        return new MezoRouteExecutorV2(
            address(musd),
            address(btc),
            address(router),
            address(factory),
            pool,
            address(bos),
            feeBps,
            feeRecipient,
            maxMusdIn,
            gauge_,
            MAX_BTC_IN
        );
    }

    function _noPermit() internal pure returns (IMezoRouteExecutorV2.Permit memory) {
        return IMezoRouteExecutorV2.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }

    /// @dev Swaps half of the post-fee amount; minimums at 1% below the pre-trade quote.
    ///      Makes external calls, so build params BEFORE `vm.prank`.
    function _enterParams(uint256 musdIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutorV2.EnterParams memory)
    {
        return _enterParams(musdIn, recipient, false);
    }

    function _enterParams(uint256 musdIn, address recipient, bool stake)
        internal
        view
        returns (IMezoRouteExecutorV2.EnterParams memory p)
    {
        uint256 net = musdIn - (musdIn * executor.feeBps()) / 10_000;
        uint256 musdToSwap = net / 2;
        uint256 btcOut = _quoteSwap(address(musd), address(btc), musdToSwap);
        p = IMezoRouteExecutorV2.EnterParams({
            musdIn: musdIn,
            musdToSwap: musdToSwap,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient,
            stake: stake
        });
    }

    /// @dev Swaps half of the post-fee BTC; minimums at 1% below the pre-trade quote.
    ///      Makes external calls, so build params BEFORE `vm.prank`.
    function _btcParams(uint256 btcIn, address recipient, bool stake)
        internal
        view
        returns (IMezoRouteExecutorV2.EnterFromBtcParams memory p)
    {
        uint256 net = btcIn - (btcIn * executor.feeBps()) / 10_000;
        uint256 btcToSwap = net / 2;
        uint256 musdOut = _quoteSwap(address(btc), address(musd), btcToSwap);
        p = IMezoRouteExecutorV2.EnterFromBtcParams({
            btcIn: btcIn,
            btcToSwap: btcToSwap,
            minMusdFromSwap: (musdOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient,
            stake: stake
        });
    }

    function _exitParams(uint256 liquidityIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutorV2.ExitParams memory p)
    {
        p = IMezoRouteExecutorV2.ExitParams({
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

    function _fundBtc(address who, uint256 amount) internal {
        btc.mint(who, amount);
        vm.prank(who);
        btc.approve(address(executor), type(uint256).max);
    }

    function _fund(address who, uint256 amount) internal {
        musd.mint(who, amount);
        vm.prank(who);
        musd.approve(address(executor), type(uint256).max);
    }
}
