// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev A gauge that credits the full amount but pulls one wei less than it was given.
contract MockUnderPullingGauge {
    address public immutable stakingToken;
    mapping(address => uint256) public balanceOf;

    constructor(address stakingToken_) {
        stakingToken = stakingToken_;
    }

    function deposit(uint256 amount, address recipient) external {
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount - 1);
        balanceOf[recipient] += amount;
    }
}
