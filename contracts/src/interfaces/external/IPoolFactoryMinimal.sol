// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of the Tigris PoolFactory used by MezoRouteLeverage.
interface IPoolFactoryMinimal {
    function getPool(address tokenA, address tokenB, bool stable) external view returns (address);

    function getFee(address pool, bool stable) external view returns (uint256);
}
