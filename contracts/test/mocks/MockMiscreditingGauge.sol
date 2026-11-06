// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev A gauge that takes the staking token but credits one wei less than it was given.
contract MockMiscreditingGauge {
    address public immutable stakingToken;
    mapping(address => uint256) public balanceOf;

    constructor(address stakingToken_) {
        stakingToken = stakingToken_;
    }

    function deposit(uint256 amount, address recipient) external {
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        balanceOf[recipient] += amount - 1;
    }
}
