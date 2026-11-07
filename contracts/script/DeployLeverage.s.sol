// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IMezoRouteLeverage} from "../src/interfaces/IMezoRouteLeverage.sol";

/// @notice Constructor input for MezoRouteLeverage per chain. Deploying goes through `cast send --create`
///         (`script/deploy-leverage.sh`), because `forge script` simulates locally and the constructor's
///         chain reads are fine there but any later BTC touch is not; this script only builds the args.
contract DeployLeverage is Script {
    function configFor(uint256 chainId, uint256 feeBps, address feeRecipient)
        public
        pure
        returns (IMezoRouteLeverage.Config memory c)
    {
        if (chainId == 31611) {
            c = IMezoRouteLeverage.Config({
                musd: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503,
                btc: 0x7b7C000000000000000000000000000000000000,
                factory: 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A,
                pool: 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9,
                borrowerOperationsSignatures: 0xD757e3646AF370b15f32EB557F0F8380Df7D639e,
                troveManager: 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0,
                priceFeed: 0x86bCF0841622a5dAC14A313a15f96A95421b9366,
                feeBps: feeBps,
                feeRecipient: feeRecipient,
                maxBtcFlash: maxBtcFlashFor(chainId),
                maxMusdFlash: maxMusdFlashFor(chainId)
            });
        } else if (chainId == 31612) {
            c = IMezoRouteLeverage.Config({
                musd: 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,
                btc: 0x7b7C000000000000000000000000000000000000,
                factory: 0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248,
                pool: 0x52e604c44417233b6CcEDDDc0d640A405Caacefb,
                borrowerOperationsSignatures: 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a,
                troveManager: 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193,
                priceFeed: 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88,
                feeBps: feeBps,
                feeRecipient: feeRecipient,
                maxBtcFlash: maxBtcFlashFor(chainId),
                maxMusdFlash: maxMusdFlashFor(chainId)
            });
        } else {
            revert("DeployLeverage: unsupported chain");
        }
    }

    /// @notice Spec L1: 0.0125 BTC on mainnet (V2's BTC cap), 12 BTC on testnet.
    function maxBtcFlashFor(uint256 chainId) public pure returns (uint256) {
        if (chainId == 31611) return 12e18;
        if (chainId == 31612) return 125e14;
        revert("DeployLeverage: unsupported chain");
    }

    /// @notice Spec L1: 2,500 MUSD on mainnet (lets a minimum Trove close), 1,000,000 MUSD on testnet.
    function maxMusdFlashFor(uint256 chainId) public pure returns (uint256) {
        if (chainId == 31611) return 1_000_000e18;
        if (chainId == 31612) return 2_500e18;
        revert("DeployLeverage: unsupported chain");
    }

    function encodedArgs(uint256 chainId, uint256 feeBps, address feeRecipient) public pure returns (bytes memory) {
        return abi.encode(configFor(chainId, feeBps, feeRecipient));
    }

    /// @notice `forge script script/DeployLeverage.s.sol --sig "print(uint256,uint256,address)" <chain> <fee> <to>`
    function print(uint256 chainId, uint256 feeBps, address feeRecipient) external pure {
        console2.logBytes(encodedArgs(chainId, feeBps, feeRecipient));
    }
}
