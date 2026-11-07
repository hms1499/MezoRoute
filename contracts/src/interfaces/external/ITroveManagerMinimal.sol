// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of MUSD TroveManager used by MezoRouteLeverage.
interface ITroveManagerMinimal {
    /// @dev Public; also applies pending redistribution, so the Trove's debt and collateral are exact after it.
    function updateSystemAndTroveInterest(address borrower) external;

    function getTroveDebt(address borrower) external view returns (uint256);

    function getTroveColl(address borrower) external view returns (uint256);

    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
}
