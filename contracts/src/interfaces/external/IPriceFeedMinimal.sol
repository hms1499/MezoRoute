// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice MUSD PriceFeed: MUSD per BTC, 1e18.
interface IPriceFeedMinimal {
    function fetchPrice() external view returns (uint256);
}
