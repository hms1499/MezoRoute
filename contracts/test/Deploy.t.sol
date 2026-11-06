// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";

contract DeployScriptTest is Test {
    Deploy internal deploy = new Deploy();

    function test_maxMusdInFor_mainnetIs1000Musd() public view {
        assertEq(deploy.maxMusdInFor(31612), 1_000e18);
    }

    function test_maxMusdInFor_testnetIs1MillionMusd() public view {
        assertEq(deploy.maxMusdInFor(31611), 1_000_000e18);
    }

    function test_maxMusdInFor_revertsOnUnknownChain() public {
        vm.expectRevert(bytes("Deploy: unsupported chain"));
        deploy.maxMusdInFor(1);
    }

    function test_maxBtcInFor_mainnetIs0_0125Btc() public view {
        assertEq(deploy.maxBtcInFor(31612), 125e14);
    }

    function test_maxBtcInFor_testnetIs12Btc() public view {
        assertEq(deploy.maxBtcInFor(31611), 12e18);
    }

    function test_maxBtcInFor_revertsOnUnknownChain() public {
        vm.expectRevert(bytes("Deploy: unsupported chain"));
        deploy.maxBtcInFor(1);
    }

    function test_gaugeFor_testnet() public view {
        assertEq(deploy.gaugeFor(31611), 0x72D88B0795373437E86792DEd8362D66dC43Cd2c);
    }

    function test_gaugeFor_mainnet() public view {
        assertEq(deploy.gaugeFor(31612), 0x8Be20a5fF57E381025aE5E3A121B697269569AaF);
    }

    function test_gaugeFor_revertsOnUnknownChain() public {
        vm.expectRevert(bytes("Deploy: unsupported chain"));
        deploy.gaugeFor(1);
    }
}
