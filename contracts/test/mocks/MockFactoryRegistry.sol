// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev The Tigris Router only asks the registry whether a factory is approved.
contract MockFactoryRegistry {
    function isPoolFactoryApproved(address) external pure returns (bool) {
        return true;
    }
}
