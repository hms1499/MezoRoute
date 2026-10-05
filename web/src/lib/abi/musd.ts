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
