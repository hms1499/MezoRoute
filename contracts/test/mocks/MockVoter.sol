// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGauge} from "@tigris/interfaces/IGauge.sol";

/// @dev Minimal stand-in for the Tigris Voter, as far as the real `Gauge` uses it: `ve()` in the
///      constructor, `isAlive` on deposit, and the voter as the only caller of `notifyRewardAmount`
///      (it must hold and approve the reward token).
contract MockVoter {
    address public immutable ve = address(0xBEEF);
    IERC20 public immutable rewardToken;
    bool private _dead;

    constructor(IERC20 rewardToken_) {
        rewardToken = rewardToken_;
    }

    function isAlive(address) external view returns (bool) {
        return !_dead;
    }

    function setAlive(bool alive) external {
        _dead = !alive;
    }

    function notify(address gauge, uint256 amount) external {
        rewardToken.approve(gauge, amount);
        IGauge(gauge).notifyRewardAmount(amount);
    }
}
