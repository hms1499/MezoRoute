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
}
