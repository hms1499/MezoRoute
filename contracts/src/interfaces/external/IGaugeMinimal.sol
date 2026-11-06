// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev The slice of Tigris `Gauge` the executor uses. `deposit(amount, recipient)` pulls the
///      staking token from the caller and credits `recipient`.
interface IGaugeMinimal {
    function stakingToken() external view returns (address);

    function balanceOf(address account) external view returns (uint256);

    function deposit(uint256 amount, address recipient) external;
}
