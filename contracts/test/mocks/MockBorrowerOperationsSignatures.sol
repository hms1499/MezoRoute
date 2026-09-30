// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockERC20Permit} from "./MockERC20Permit.sol";

/// @dev Mimics the parts of MUSD BorrowerOperationsSignatures the executor relies on:
///      anyone may submit a signature, each signature works once, and MUSD goes to `recipient`.
contract MockBorrowerOperationsSignatures {
    MockERC20Permit public immutable musd;
    mapping(bytes32 => bool) public used;

    address public lastBorrower;
    address public lastRecipient;

    constructor(MockERC20Permit musd_) {
        musd = musd_;
    }

    function withdrawMUSDWithSignature(
        uint256 amount,
        address,
        address,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 key = keccak256(abi.encode(signature, borrower, recipient, amount));
        require(!used[key], "BorrowerOperationsSignatures: Invalid signature");
        used[key] = true;
        lastBorrower = borrower;
        lastRecipient = recipient;
        musd.mint(recipient, amount);
    }
}
