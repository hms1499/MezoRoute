// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Router} from "@tigris/Router.sol";
import {IRouter} from "@tigris/interfaces/IRouter.sol";
import {MezoRouteLeverage} from "../../src/MezoRouteLeverage.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockUnifiedBtc} from "../mocks/MockUnifiedBtc.sol";
import {MockMusdProtocol} from "../mocks/MockMusdProtocol.sol";
import {MockPriceFeed} from "../mocks/MockPriceFeed.sol";

/// @dev Random Unwind / Close / Leverage / Open by three actors, mixed with third-party pool trades,
///      oracle moves and donations to the contract. A reverted action changes nothing; a successful one
///      is checked right away for the recipient rule and a zero allowance.
contract LeverageHandler is Test {
    MezoRouteLeverage public immutable leverage;
    MockERC20Permit public immutable musd;
    MockUnifiedBtc public immutable btc;
    MockMusdProtocol public immutable protocol;
    MockPriceFeed public immutable priceFeed;
    Router public immutable router;
    address public immutable pool;
    address public immutable factory;
    uint256 public immutable basePrice;

    uint256[3] internal keys = [uint256(0xA1), 0xA2, 0xA3];
    address public trader = makeAddr("trader");

    uint256 public donatedMusd;
    uint256 public donatedBtc;
    uint256 public violations;
    uint256 public successes;

    constructor(
        MezoRouteLeverage leverage_,
        MockERC20Permit musd_,
        MockUnifiedBtc btc_,
        MockMusdProtocol protocol_,
        MockPriceFeed priceFeed_,
        Router router_,
        address pool_,
        address factory_
    ) {
        leverage = leverage_;
        musd = musd_;
        btc = btc_;
        protocol = protocol_;
        priceFeed = priceFeed_;
        router = router_;
        pool = pool_;
        factory = factory_;
        basePrice = priceFeed_.fetchPrice();
    }

    function actor(uint256 seed) public view returns (address) {
        return vm.addr(keys[seed % 3]);
    }

    function actorsLength() external pure returns (uint256) {
        return 3;
    }

    // ---------------------------------------------------------------- Trove actions

    function unwind(uint256 seed, uint256 repay) external {
        address who = actor(seed);
        uint256 debt = protocol.getTroveDebt(who);
        if (debt < 2_100e18) return;
        repay = bound(repay, 1e18, debt - 2_000e18);
        uint256 withdrawal = (_btcIn(repay) * 102) / 100;
        IMezoRouteLeverage.UnwindParams memory p = IMezoRouteLeverage.UnwindParams({
            debtToRepay: repay,
            collWithdrawal: withdrawal,
            maxBtcToPool: withdrawal,
            maxDeviationBps: 1_000,
            deadline: block.timestamp + 600
        });
        bytes memory sig = abi.encode(
            keccak256(abi.encode("AdjustTrove", withdrawal, repay, false, uint256(0), who, who)), protocol.getNonce(who)
        );
        IMezoRouteLeverage.Permit memory permit = _permit(address(btc), seed, withdrawal);
        vm.prank(who);
        leverage.unwind(p, _auth(sig), permit);
        _after(who);
    }

    function close(uint256 seed) external {
        address who = actor(seed);
        uint256 debt = protocol.getTroveDebt(who);
        if (debt <= 200e18) return;
        uint256 maxBtc = (_btcIn(debt - 200e18) * 102) / 100;
        IMezoRouteLeverage.CloseParams memory p = IMezoRouteLeverage.CloseParams({
            maxBtcToPool: maxBtc, maxDeviationBps: 1_000, deadline: block.timestamp + 600
        });
        bytes memory sig = abi.encode(keccak256(abi.encode("CloseTrove", who, who)), protocol.getNonce(who));
        IMezoRouteLeverage.Permit memory permit = _permit(address(btc), seed, maxBtc);
        vm.prank(who);
        leverage.close(p, _auth(sig), permit);
        _after(who);
    }

    function lever(uint256 seed, uint256 btcToAdd) external {
        address who = actor(seed);
        if (protocol.getTroveDebt(who) == 0) return;
        btcToAdd = bound(btcToAdd, 1e15, 0.5e18);
        uint256 maxMusd = (_musdIn(btcToAdd) * 102) / 100;
        uint256 pull = maxMusd + (maxMusd * leverage.feeBps()) / 10_000;
        IMezoRouteLeverage.LeverageParams memory p = IMezoRouteLeverage.LeverageParams({
            btcToAdd: btcToAdd,
            debtIncrease: pull,
            maxMusdToPool: maxMusd,
            minCollateralRatio: 1.5e18,
            maxDeviationBps: 1_000,
            deadline: block.timestamp + 600
        });
        bytes memory sig = abi.encode(
            keccak256(abi.encode("AdjustTrove", uint256(0), pull, true, btcToAdd, who, who)), protocol.getNonce(who)
        );
        IMezoRouteLeverage.Permit memory permit = _permit(address(musd), seed, pull);
        vm.prank(who);
        leverage.leverage(p, _auth(sig), permit);
        _after(who);
    }

    function open(uint256 seed, uint256 own, uint256 flash) external {
        address who = actor(seed);
        if (protocol.getTroveDebt(who) != 0) return;
        own = bound(own, 0.05e18, 2e18);
        flash = bound(flash, 1e15, own / 2);
        uint256 maxMusd = (_musdIn(flash) * 102) / 100;
        uint256 pull = maxMusd + (maxMusd * leverage.feeBps()) / 10_000;
        uint256 debt = pull > 2_000e18 ? pull : 2_000e18;
        IMezoRouteLeverage.OpenLeveragedParams memory p = IMezoRouteLeverage.OpenLeveragedParams({
            btcToFlash: flash,
            debtAmount: debt,
            maxMusdToPool: maxMusd,
            minCollateralRatio: 1.5e18,
            maxDeviationBps: 1_000,
            deadline: block.timestamp + 600
        });
        bytes memory sig =
            abi.encode(keccak256(abi.encode("OpenTrove", own + flash, debt, who, who)), protocol.getNonce(who));
        IMezoRouteLeverage.Permit memory permit = _permit(address(musd), seed, pull);
        vm.deal(who, who.balance + own); // test-level funding, outside the call that may revert
        vm.prank(who);
        leverage.openLeveraged{value: own}(p, _auth(sig), permit);
        _after(who);
    }

    // ---------------------------------------------------------------- the world moving

    function movePool(uint256 amount, bool buyBtc) external {
        IRouter.Route[] memory routes = new IRouter.Route[](1);
        if (buyBtc) {
            amount = bound(amount, 1e18, 50_000e18);
            musd.mint(trader, amount);
            routes[0] = IRouter.Route({from: address(musd), to: address(btc), stable: false, factory: factory});
            vm.startPrank(trader);
            musd.approve(address(router), amount);
        } else {
            amount = bound(amount, 1e13, 0.5e18);
            btc.mint(trader, amount);
            routes[0] = IRouter.Route({from: address(btc), to: address(musd), stable: false, factory: factory});
            vm.startPrank(trader);
            btc.approve(address(router), amount);
        }
        router.swapExactTokensForTokens(amount, 0, routes, trader, block.timestamp);
        vm.stopPrank();
    }

    function moveOracle(uint256 bps, bool up) external {
        bps = bound(bps, 0, 1_000);
        priceFeed.setPrice(up ? (basePrice * (10_000 + bps)) / 10_000 : (basePrice * (10_000 - bps)) / 10_000);
    }

    function donate(uint256 musdAmount, uint256 btcAmount) external {
        musdAmount = bound(musdAmount, 0, 10_000e18);
        btcAmount = bound(btcAmount, 0, 0.1e18);
        musd.mint(address(leverage), musdAmount);
        btc.mint(address(this), btcAmount);
        btc.transfer(address(leverage), btcAmount);
        donatedMusd += musdAmount;
        donatedBtc += btcAmount;
    }

    // ---------------------------------------------------------------- helpers

    function _after(address who) private {
        successes++;
        if (protocol.lastBorrower() != who || protocol.lastRecipient() != who) violations++;
        if (protocol.lastCaller() != address(leverage)) violations++;
        if (musd.allowance(who, address(leverage)) != 0 || btc.allowance(who, address(leverage)) != 0) violations++;
    }

    function _auth(bytes memory sig) private view returns (IMezoRouteLeverage.TroveAuth memory) {
        return IMezoRouteLeverage.TroveAuth({
            upperHint: address(0), lowerHint: address(0), signature: sig, deadline: block.timestamp + 600
        });
    }

    function _permit(address token, uint256 seed, uint256 value)
        private
        view
        returns (IMezoRouteLeverage.Permit memory)
    {
        uint256 key = keys[seed % 3];
        address owner = vm.addr(key);
        uint256 deadline = block.timestamp + 600;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(leverage),
                value,
                MockERC20Permit(token).nonces(owner),
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", MockERC20Permit(token).DOMAIN_SEPARATOR(), structHash)));
        return IMezoRouteLeverage.Permit({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    function _reserves() private view returns (uint256 rm, uint256 rb) {
        (bool ok, bytes memory out) = pool.staticcall(abi.encodeWithSignature("getReserves()"));
        require(ok, "reserves");
        (uint256 r0, uint256 r1,) = abi.decode(out, (uint256, uint256, uint256));
        (rm, rb) = leverage.btcIsToken0() ? (r1, r0) : (r0, r1);
    }

    function _fee() private view returns (uint256) {
        (bool ok, bytes memory out) = factory.staticcall(abi.encodeWithSignature("getFee(address,bool)", pool, false));
        require(ok, "fee");
        return abi.decode(out, (uint256));
    }

    function _btcIn(uint256 musdOut) private view returns (uint256) {
        (uint256 rm, uint256 rb) = _reserves();
        return leverage.exactInput(rb, rm, musdOut, _fee());
    }

    function _musdIn(uint256 btcOut) private view returns (uint256) {
        (uint256 rm, uint256 rb) = _reserves();
        return leverage.exactInput(rm, rb, btcOut, _fee());
    }
}
