// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev MUSD PriceFeed: MUSD per BTC, 1e18.
contract MockPriceFeed {
    uint256 public price;

    constructor(uint256 price_) {
        price = price_;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }
}
