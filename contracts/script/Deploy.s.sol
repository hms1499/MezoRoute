// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MezoRouteExecutor} from "../src/MezoRouteExecutor.sol";

/// @notice Deploys MezoRouteExecutor with the fixed Mezo addresses for the current chain.
/// Env: FEE_BPS (e.g. 10), FEE_RECIPIENT (address).
contract Deploy is Script {
    struct MezoAddresses {
        address musd;
        address btc;
        address router;
        address factory;
        address pool;
        address borrowerOperationsSignatures;
    }

    function addressesFor(uint256 chainId) public pure returns (MezoAddresses memory) {
        if (chainId == 31611) {
            return MezoAddresses({
                musd: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503,
                btc: 0x7b7C000000000000000000000000000000000000,
                router: 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9,
                factory: 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A,
                pool: 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9,
                borrowerOperationsSignatures: 0xD757e3646AF370b15f32EB557F0F8380Df7D639e
            });
        }
        if (chainId == 31612) {
            return MezoAddresses({
                musd: 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,
                btc: 0x7b7C000000000000000000000000000000000000,
                router: 0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706,
                factory: 0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248,
                pool: 0x52e604c44417233b6CcEDDDc0d640A405Caacefb,
                borrowerOperationsSignatures: 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a
            });
        }
        revert("Deploy: unsupported chain");
    }

    function run() external returns (MezoRouteExecutor executor) {
        MezoAddresses memory a = addressesFor(block.chainid);
        uint256 feeBps = vm.envUint("FEE_BPS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        executor = new MezoRouteExecutor(
            a.musd, a.btc, a.router, a.factory, a.pool, a.borrowerOperationsSignatures, feeBps, feeRecipient
        );
        vm.stopBroadcast();

        console2.log("MezoRouteExecutor", address(executor));
    }
}
