import { parseAbi } from "viem";

// MUSD protocol reads (mezo-org/musd `solidity/contracts`), checked against both networks on 5 Oct 2026.

export const troveManagerAbi = parseAbi([
  "function MCR() view returns (uint256)",
  "function getTroveStatus(address borrower) view returns (uint8)",
  "function getEntireDebtAndColl(address borrower) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getTroveMaxBorrowingCapacity(address borrower) view returns (uint256)",
]);

export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);

export const borrowerOperationsAbi = parseAbi(["function borrowingRate() view returns (uint256)"]);

export const stabilityPoolAbi = parseAbi([
  "function getCompoundedMUSDDeposit(address depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address depositor) view returns (uint256)",
]);

/** MUSD's EIP-2612 nonce (the token has no PERMIT_TYPEHASH or version() getter; its domain is in eip712Domain()). */
export const musdPermitAbi = parseAbi(["function nonces(address owner) view returns (uint256)"]);

/** BorrowerOperationsSignatures: the EIP-712 nonce of a borrower (spec §4). */
export const borrowerOperationsSignaturesAbi = parseAbi(["function getNonce(address user) view returns (uint256)"]);

/** System totals for recovery mode (TCR = coll × price / debt < CCR) and the hint trial count. */
export const troveSystemAbi = parseAbi([
  "function getEntireSystemColl() view returns (uint256)",
  "function getEntireSystemDebt() view returns (uint256)",
  "function CCR() view returns (uint256)",
  "function getTroveOwnersCount() view returns (uint256)",
]);

export const hintHelpersAbi = parseAbi([
  "function getApproxHint(uint256 CR, uint256 numTrials, uint256 inputRandomSeed) view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)",
]);

export const sortedTrovesAbi = parseAbi([
  "function findInsertPosition(uint256 NICR, address prevId, address nextId) view returns (address, address)",
]);
