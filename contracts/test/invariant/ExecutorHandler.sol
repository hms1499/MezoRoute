// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MezoRouteExecutor} from "../../src/MezoRouteExecutor.sol";
import {IMezoRouteExecutor} from "../../src/interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {ITigrisQuoter} from "../harness/ITigrisQuoter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";

/// @dev Drives random enters, exits and donations; tracks what was donated to the executor.
contract ExecutorHandler is Test {
    MezoRouteExecutor internal executor;
    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    IERC20 internal pool;
    address internal router;
    address internal factory;
    address[] internal actors;

    uint256 public donatedMusd;
    uint256 public donatedBtc;
    uint256 public donatedLp;

    constructor(
        MezoRouteExecutor executor_,
        MockERC20Permit musd_,
        MockERC20Permit btc_,
        address router_,
        address factory_
    ) {
        executor = executor_;
        musd = musd_;
        btc = btc_;
        pool = IERC20(address(executor_.pool()));
        router = router_;
        factory = factory_;
        for (uint256 i; i < 3; ++i) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            vm.startPrank(a);
            musd.approve(address(executor), type(uint256).max);
            pool.approve(address(executor), type(uint256).max);
            vm.stopPrank();
        }
    }

    function enter(uint256 actorSeed, uint256 amount) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 1e18, 20_000e18);
        musd.mint(a, amount);
        uint256 net = amount - (amount * executor.feeBps()) / 10_000;
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route(address(musd), address(btc), false, factory);
        uint256 btcOut = ITigrisQuoter(router).getAmountsOut(net / 2, routes)[1];
        IMezoRouteExecutor.EnterParams memory p = IMezoRouteExecutor.EnterParams({
            musdIn: amount,
            musdToSwap: net / 2,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: a
        });
        vm.prank(a);
        executor.enter(p, _noPermit());
    }

    function exit(uint256 actorSeed, uint256 fraction) external {
        address a = actors[actorSeed % actors.length];
        uint256 lp = pool.balanceOf(a);
        if (lp == 0) return;
        uint256 amount = (lp * bound(fraction, 1, 100)) / 100;
        if (amount == 0) return;
        IMezoRouteExecutor.ExitParams memory p = IMezoRouteExecutor.ExitParams({
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

    function _noPermit() internal pure returns (IMezoRouteExecutor.Permit memory) {
        return IMezoRouteExecutor.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }
}
