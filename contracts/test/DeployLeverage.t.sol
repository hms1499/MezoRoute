// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeployLeverage} from "../script/DeployLeverage.s.sol";
import {IMezoRouteLeverage} from "../src/interfaces/IMezoRouteLeverage.sol";

contract DeployLeverageScriptTest is Test {
    DeployLeverage internal deploy = new DeployLeverage();
    address internal constant RECIPIENT = 0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8;

    function test_caps_testnet() public view {
        assertEq(deploy.maxBtcFlashFor(31611), 12e18);
        assertEq(deploy.maxMusdFlashFor(31611), 1_000_000e18);
    }

    function test_caps_mainnet() public view {
        assertEq(deploy.maxBtcFlashFor(31612), 125e14);
        assertEq(deploy.maxMusdFlashFor(31612), 2_500e18);
    }

    function test_caps_revertOnUnknownChain() public {
        vm.expectRevert(bytes("DeployLeverage: unsupported chain"));
        deploy.maxBtcFlashFor(1);
        vm.expectRevert(bytes("DeployLeverage: unsupported chain"));
        deploy.maxMusdFlashFor(1);
    }

    function test_config_testnet() public view {
        IMezoRouteLeverage.Config memory c = deploy.configFor(31611, 10, RECIPIENT);
        assertEq(c.musd, 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
        assertEq(c.btc, 0x7b7C000000000000000000000000000000000000);
        assertEq(c.factory, 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A);
        assertEq(c.pool, 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9);
        assertEq(c.borrowerOperationsSignatures, 0xD757e3646AF370b15f32EB557F0F8380Df7D639e);
        assertEq(c.troveManager, 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0);
        assertEq(c.priceFeed, 0x86bCF0841622a5dAC14A313a15f96A95421b9366);
        assertEq(c.feeBps, 10);
        assertEq(c.feeRecipient, RECIPIENT);
        assertEq(c.maxBtcFlash, 12e18);
        assertEq(c.maxMusdFlash, 1_000_000e18);
    }

    function test_config_mainnet() public view {
        IMezoRouteLeverage.Config memory c = deploy.configFor(31612, 10, RECIPIENT);
        assertEq(c.musd, 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186);
        assertEq(c.factory, 0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248);
        assertEq(c.pool, 0x52e604c44417233b6CcEDDDc0d640A405Caacefb);
        assertEq(c.borrowerOperationsSignatures, 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a);
        assertEq(c.troveManager, 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193);
        assertEq(c.priceFeed, 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88);
        assertEq(c.maxBtcFlash, 125e14);
        assertEq(c.maxMusdFlash, 2_500e18);
    }

    function test_encodedArgs_matchConfig() public view {
        assertEq(deploy.encodedArgs(31611, 10, RECIPIENT), abi.encode(deploy.configFor(31611, 10, RECIPIENT)));
    }
}
