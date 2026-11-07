// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of the Tigris Pool used by MezoRouteLeverage.
interface IPoolMinimal {
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;

    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);

    function token0() external view returns (address);
}
