// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockERC20Permit} from "./MockERC20Permit.sol";

/// @dev MUSD stand-in that calls back into a target once during transferFrom.
contract ReentrantMUSD is MockERC20Permit {
    address public target;
    bytes public payload;

    constructor() MockERC20Permit("Mezo USD", "MUSD") {}

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address t = target;
        if (t != address(0)) {
            target = address(0);
            (bool ok, bytes memory ret) = t.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        return super.transferFrom(from, to, amount);
    }
}
