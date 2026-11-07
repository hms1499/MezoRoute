// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {IRouter} from "@tigris/interfaces/IRouter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockUnifiedBtc} from "../mocks/MockUnifiedBtc.sol";
import {MockFactoryRegistry} from "../mocks/MockFactoryRegistry.sol";
import {MockMusdProtocol} from "../mocks/MockMusdProtocol.sol";
import {MockPriceFeed} from "../mocks/MockPriceFeed.sol";

/// @dev The real Tigris Pool/PoolFactory/Router with mock MUSD and a unified-ledger mock BTC, plus a
///      mock MUSD protocol (BOS + TroveManager) and PriceFeed. Every suite runs under both token
///      orders: testnet's pool has MUSD as token0, mainnet's has BTC.
abstract contract LeverageHarness is Test {
    uint256 internal constant SEED_MUSD = 1_000_000e18;
    uint256 internal constant SEED_BTC = 10e18; // 1 BTC = 100,000 MUSD
    uint256 internal constant ORACLE_PRICE = 100_000e18;

    MockERC20Permit internal musd;
    MockUnifiedBtc internal btc;
    PoolFactory internal factory;
    Router internal router;
    address internal pool;
    MockMusdProtocol internal protocol;
    MockPriceFeed internal priceFeed;
    bool internal btcIsToken0;

    address internal feeRecipient = makeAddr("feeRecipient");
    address internal seeder = makeAddr("seeder");
    uint256 internal userKey = 0xA11CE;
    address internal user = vm.addr(userKey);

    function _newMusd() internal virtual returns (MockERC20Permit) {
        return new MockERC20Permit("Mezo USD", "MUSD");
    }

    /// @dev True to build the pool with BTC as token0 (mainnet's order).
    function _btcFirst() internal pure virtual returns (bool);

    function setUp() public virtual {
        btc = new MockUnifiedBtc();
        musd = _newMusd();
        // Tigris sorts tokens by address; redeploy MUSD until the order is the one wanted.
        for (uint256 i = 0; (address(btc) < address(musd)) != _btcFirst(); i++) {
            require(i < 32, "harness: token order not reached");
            musd = _newMusd();
        }
        btcIsToken0 = address(btc) < address(musd);

        factory = new PoolFactory(address(new Pool()));
        router = new Router(address(0), address(new MockFactoryRegistry()), address(factory));
        pool = factory.createPool(address(musd), address(btc), false);
        priceFeed = new MockPriceFeed(ORACLE_PRICE);
        protocol = new MockMusdProtocol(musd, priceFeed);

        musd.mint(seeder, SEED_MUSD);
        btc.mint(seeder, SEED_BTC);
        vm.startPrank(seeder);
        musd.approve(address(router), SEED_MUSD);
        btc.approve(address(router), SEED_BTC);
        router.addLiquidity(address(musd), address(btc), false, SEED_MUSD, SEED_BTC, 0, 0, seeder, block.timestamp);
        vm.stopPrank();
    }

    function _route(address from, address to) internal view returns (IRouter.Route[] memory routes) {
        routes = new IRouter.Route[](1);
        routes[0] = IRouter.Route({from: from, to: to, stable: false, factory: address(factory)});
    }

    /// @dev An active Trove with `coll` BTC and `debt` MUSD of principal (gas compensation included).
    function _openTrove(address borrower, uint256 coll, uint256 debt) internal {
        protocol.seedTrove(borrower, coll, debt);
        vm.deal(address(protocol), address(protocol).balance + coll);
    }

    function _sigAdjust(
        address borrower,
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        uint256 assetAmount
    ) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encode("AdjustTrove", collWithdrawal, debtChange, isDebtIncrease, assetAmount, borrower, borrower)
        );
        return abi.encode(digest, protocol.getNonce(borrower));
    }

    function _sigClose(address borrower) internal view returns (bytes memory) {
        return abi.encode(keccak256(abi.encode("CloseTrove", borrower, borrower)), protocol.getNonce(borrower));
    }

    function _sigOpen(address borrower, uint256 assetAmount, uint256 debtAmount) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encode("OpenTrove", assetAmount, debtAmount, borrower, borrower));
        return abi.encode(digest, protocol.getNonce(borrower));
    }

    /// @dev EIP-2612 signature by `ownerKey` for `token` (MUSD or BTC mock).
    function _signPermit(address token, uint256 ownerKey, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        address owner = vm.addr(ownerKey);
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                MockERC20Permit(token).nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", MockERC20Permit(token).DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(ownerKey, digest);
    }
}
