// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Gauge} from "@tigris/gauges/Gauge.sol";
import {MezoRouteExecutorV2} from "../../src/MezoRouteExecutorV2.sol";
import {IMezoRouteExecutorV2} from "../../src/interfaces/IMezoRouteExecutorV2.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {ITigrisQuoter} from "../harness/ITigrisQuoter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockVoter} from "../mocks/MockVoter.sol";

/// @dev Drives random enters (MUSD and BTC, staked or not), exits, unstaking, emissions, donations,
///      and time warps; tracks what was donated to the executor.
contract ExecutorV2Handler is Test {
    MezoRouteExecutorV2 internal executor;
    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    MockERC20Permit internal mezo;
    MockVoter internal voter;
    Gauge internal gauge;
    IERC20 internal pool;
    address internal router;
    address internal factory;
    address[] internal actors;

    uint256 public donatedMusd;
    uint256 public donatedBtc;
    uint256 public donatedLp;

    constructor(
        MezoRouteExecutorV2 executor_,
        MockERC20Permit musd_,
        MockERC20Permit btc_,
        MockERC20Permit mezo_,
        MockVoter voter_,
        Gauge gauge_,
        address router_,
        address factory_
    ) {
        executor = executor_;
        musd = musd_;
        btc = btc_;
        mezo = mezo_;
        voter = voter_;
        gauge = gauge_;
        pool = IERC20(address(executor_.pool()));
        router = router_;
        factory = factory_;
        for (uint256 i; i < 3; ++i) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            vm.startPrank(a);
            musd.approve(address(executor), type(uint256).max);
            btc.approve(address(executor), type(uint256).max);
            pool.approve(address(executor), type(uint256).max);
            vm.stopPrank();
        }
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function enter(uint256 actorSeed, uint256 amount, bool stake) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 1e18, 20_000e18);
        musd.mint(a, amount);
        uint256 net = amount - (amount * executor.feeBps()) / 10_000;
        uint256 btcOut = _quote(address(musd), address(btc), net / 2);
        IMezoRouteExecutorV2.EnterParams memory p = IMezoRouteExecutorV2.EnterParams({
            musdIn: amount,
            musdToSwap: net / 2,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: a,
            stake: stake
        });
        vm.prank(a);
        executor.enter(p, _noPermit());
    }

    function enterFromBtc(uint256 actorSeed, uint256 amount, bool stake) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 0.001e18, 0.2e18);
        btc.mint(a, amount);
        uint256 net = amount - (amount * executor.feeBps()) / 10_000;
        uint256 musdOut = _quote(address(btc), address(musd), net / 2);
        IMezoRouteExecutorV2.EnterFromBtcParams memory p = IMezoRouteExecutorV2.EnterFromBtcParams({
            btcIn: amount,
            btcToSwap: net / 2,
            minMusdFromSwap: (musdOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: a,
            stake: stake
        });
        vm.prank(a);
        executor.enterFromBtc(p, _noPermit());
    }

    function exit(uint256 actorSeed, uint256 fraction) external {
        address a = actors[actorSeed % actors.length];
        uint256 lp = pool.balanceOf(a);
        if (lp == 0) return;
        uint256 amount = (lp * bound(fraction, 1, 100)) / 100;
        if (amount == 0) return;
        IMezoRouteExecutorV2.ExitParams memory p = IMezoRouteExecutorV2.ExitParams({
            liquidityIn: amount,
            minMusdRemoved: 0,
            minBtcRemoved: 0,
            minMusdFromSwap: 0,
            minMusdOut: 0,
            deadline: block.timestamp + 600,
            recipient: a
        });
        vm.prank(a);
        executor.exit(p, _noPermit());
    }

    /// @dev Moves staked LP back to the actor's wallet so that a later `exit` can use it.
    function unstake(uint256 actorSeed, uint256 fraction) external {
        address a = actors[actorSeed % actors.length];
        uint256 staked = gauge.balanceOf(a);
        if (staked == 0) return;
        uint256 amount = (staked * bound(fraction, 1, 100)) / 100;
        if (amount == 0) return;
        vm.prank(a);
        gauge.withdraw(amount);
    }

    function notifyEmissions(uint256 amount) external {
        amount = bound(amount, 1e18, 1_000e18);
        if (mezo.balanceOf(address(voter)) < amount) return;
        voter.notify(address(gauge), amount);
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }

    function donate(uint256 musdAmount, uint256 btcAmount, uint256 actorSeed, uint256 lpFraction) external {
        musdAmount = bound(musdAmount, 0, 1_000e18);
        btcAmount = bound(btcAmount, 0, 1e16);
        musd.mint(address(executor), musdAmount);
        btc.mint(address(executor), btcAmount);
        donatedMusd += musdAmount;
        donatedBtc += btcAmount;

        address a = actors[actorSeed % actors.length];
        uint256 lp = (pool.balanceOf(a) * bound(lpFraction, 0, 10)) / 100;
        if (lp > 0) {
            vm.prank(a);
            pool.transfer(address(executor), lp);
            donatedLp += lp;
        }
    }

    function _quote(address from, address to, uint256 amountIn) internal view returns (uint256) {
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route(from, to, false, factory);
        return ITigrisQuoter(router).getAmountsOut(amountIn, routes)[1];
    }

    function _noPermit() internal pure returns (IMezoRouteExecutorV2.Permit memory) {
        return IMezoRouteExecutorV2.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }
}
