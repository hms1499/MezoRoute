// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";

contract DeployScriptTest is Test {
    function test_run_refusesMainnetUntilCappedExecutorExists() public {
        vm.setEnv("FEE_BPS", "10");
        vm.setEnv("FEE_RECIPIENT", vm.toString(makeAddr("feeRecipient")));
        vm.chainId(31612);
        Deploy deploy = new Deploy();
        vm.expectRevert(bytes("Deploy: mainnet needs the Wave 2 per-transaction cap"));
        deploy.run();
    }
}
