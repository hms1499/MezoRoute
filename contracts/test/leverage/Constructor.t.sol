// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pool} from "@tigris/Pool.sol";
import {LeverageBase} from "./LeverageBase.sol";
import {MezoRouteLeverage} from "../../src/MezoRouteLeverage.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

abstract contract ConstructorTest is LeverageBase {
    function deployExternal(IMezoRouteLeverage.Config memory c) external {
        new MezoRouteLeverage(c);
    }

    function test_constructor_zeroAddressReverts() public {
        for (uint256 i = 0; i < 8; i++) {
            IMezoRouteLeverage.Config memory c = _config(FEE_BPS, MAX_BTC_FLASH, MAX_MUSD_FLASH);
            if (i == 0) c.musd = address(0);
            if (i == 1) c.btc = address(0);
            if (i == 2) c.factory = address(0);
            if (i == 3) c.pool = address(0);
            if (i == 4) c.borrowerOperationsSignatures = address(0);
            if (i == 5) c.troveManager = address(0);
            if (i == 6) c.priceFeed = address(0);
            if (i == 7) c.feeRecipient = address(0);
            vm.expectRevert(IMezoRouteLeverage.ZeroAddress.selector);
            this.deployExternal(c);
        }
    }

    function test_constructor_zeroCapReverts() public {
        vm.expectRevert(IMezoRouteLeverage.ZeroAmount.selector);
        this.deployExternal(_config(FEE_BPS, 0, MAX_MUSD_FLASH));
        vm.expectRevert(IMezoRouteLeverage.ZeroAmount.selector);
        this.deployExternal(_config(FEE_BPS, MAX_BTC_FLASH, 0));
    }

    function test_constructor_feeTooHigh() public {
        vm.expectRevert(IMezoRouteLeverage.FeeTooHigh.selector);
        this.deployExternal(_config(51, MAX_BTC_FLASH, MAX_MUSD_FLASH));
    }

    function test_constructor_poolMismatch() public {
        IMezoRouteLeverage.Config memory c = _config(FEE_BPS, MAX_BTC_FLASH, MAX_MUSD_FLASH);
        c.pool = factory.createPool(address(musd), address(btc), true); // the stable pool, not the volatile one
        vm.expectRevert(IMezoRouteLeverage.PoolMismatch.selector);
        this.deployExternal(c);
    }

    function test_constructor_tokenOrderMatchesPool() public view {
        assertEq(leverage.btcIsToken0(), Pool(pool).token0() == address(btc));
        assertEq(leverage.feeBps(), FEE_BPS);
        assertEq(leverage.maxBtcFlash(), MAX_BTC_FLASH);
        assertEq(leverage.maxMusdFlash(), MAX_MUSD_FLASH);
        assertEq(leverage.MAX_DEVIATION_BPS(), 1_000);
        assertEq(leverage.MIN_CR_FLOOR(), 1.5e18);
    }
}

contract ConstructorTestMusdFirst is ConstructorTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract ConstructorTestBtcFirst is ConstructorTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
