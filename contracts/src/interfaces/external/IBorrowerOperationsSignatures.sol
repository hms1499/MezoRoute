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

    /// @dev The signature binds `msg.value` as `assetAmount`; a repayment is burned from the caller.
    function adjustTroveWithSignature(
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        address upperHint,
        address lowerHint,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external payable;

    /// @dev Burns `debt - gas compensation` from the caller; all collateral goes to `recipient`.
    function closeTroveWithSignature(address borrower, address recipient, bytes memory signature, uint256 deadline)
        external;

    /// @dev The signature binds `msg.value` as `assetAmount`.
    function openTroveWithSignature(
        uint256 debtAmount,
        address upperHint,
        address lowerHint,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external payable;
}
