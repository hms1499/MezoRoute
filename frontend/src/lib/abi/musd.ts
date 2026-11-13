import { parseAbi } from "viem";

// MUSD protocol reads (mezo-org/musd `solidity/contracts`), checked against both networks on 5 Oct 2026.

export const troveManagerAbi = parseAbi([
  "function MCR() view returns (uint256)",
  "function getTroveStatus(address borrower) view returns (uint8)",
  "function getEntireDebtAndColl(address borrower) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getTroveMaxBorrowingCapacity(address borrower) view returns (uint256)",
  // L1: interest rate (bps), the redemption order (NICR), ICR at a price, and the owners list.
  "function getTroveInterestRate(address borrower) view returns (uint16)",
  "function getNominalICR(address borrower) view returns (uint256)",
  "function getCurrentICR(address borrower, uint256 price) view returns (uint256)",
  "function getTroveOwnersCount() view returns (uint256)",
  "function getTroveFromTroveOwnersArray(uint256 index) view returns (address)",
]);

export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);

export const borrowerOperationsAbi = parseAbi([
  "function borrowingRate() view returns (uint256)",
  // L1 direct calls from the wallet (any wallet type): refinance resets borrowing capacity; claimCollateral
  // returns surplus BTC after a redemption or liquidation; repayMUSD is allowed in Recovery Mode.
  "function refinance(address upperHint, address lowerHint)",
  "function claimCollateral()",
  "function repayMUSD(uint256 amount, address upperHint, address lowerHint)",
]);

/** CollSurplusPool: BTC left for a borrower after a redemption (or a Recovery Mode liquidation) closed the Trove. */
export const collSurplusPoolAbi = parseAbi(["function getCollateral(address account) view returns (uint256)"]);

/** InterestRateManager: the rate (bps a year) a Trove opened now would get. */
export const interestRateManagerAbi = parseAbi(["function interestRate() view returns (uint16)"]);

/** StabilityPool (mezo-org/musd `StabilityPool.sol`); deposits and withdrawals act only for msg.sender. */
export const stabilityPoolAbi = parseAbi([
  "function getCompoundedMUSDDeposit(address depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address depositor) view returns (uint256)",
  "function deposits(address depositor) view returns (uint256)",
  "function P() view returns (uint256)",
  "function currentEpoch() view returns (uint128)",
  "function currentScale() view returns (uint128)",
  "function epochToScaleToSum(uint128 epoch, uint128 scale) view returns (uint256)",
  "function getTotalMUSDDeposits() view returns (uint256)",
  "function provideToSP(uint256 amount)",
  "function withdrawFromSP(uint256 amount)",
  "event UserDepositChanged(address indexed depositor, uint256 newDeposit)",
  "event CollateralGainWithdrawn(address indexed depositor, uint256 collateral, uint256 MUSDLoss)",
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
