// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of MUSD BorrowerOperationsSignatures used by MezoRoute.
interface IBorrowerOperationsSignatures {
    function withdrawMUSDWithSignature(
        uint256 amount,
        address upperHint,
        address lowerHint,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external;
}
