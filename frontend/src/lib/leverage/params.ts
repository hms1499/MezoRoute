import type { Address, Hex } from "viem";
import { mezoRouteLeverageAbi } from "@/lib/abi/mezoRouteLeverage";
import { borrowerOperationsAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import type { ExecutorPermit } from "@/lib/routes/musd-btc-lp/params";
import type { CloseQuote } from "./quote-close";
import type { LeverageQuote } from "./quote-leverage";
import type { OpenQuote } from "./quote-open";
import type { UnwindQuote } from "./quote-unwind";

/** A signed BorrowerOperationsSignatures authorisation; hints are not signed and are found at send time. */
export type TroveAuth = { upperHint: Address; lowerHint: Address; signature: Hex; deadline: bigint };

function contract(network: NetworkConfig): Address {
  if (network.leverage === null) throw new Error("MezoRouteLeverage is not deployed on this network");
  return network.leverage.address;
}

// The contract acts for msg.sender (borrower = recipient = caller), so no call carries an address but the hints.

export function buildUnwindCall(network: NetworkConfig, q: UnwindQuote, auth: TroveAuth, permit: ExecutorPermit, boundBps: bigint, deadline: bigint) {
  return {
    address: contract(network),
    abi: mezoRouteLeverageAbi,
    functionName: "unwind",
    args: [
      { debtToRepay: q.debtToRepay, collWithdrawal: q.collWithdrawal, maxBtcToPool: q.maxBtcToPool, maxDeviationBps: boundBps, deadline },
      auth,
      permit,
    ],
  } as const;
}

export function buildCloseCall(network: NetworkConfig, q: CloseQuote, auth: TroveAuth, permit: ExecutorPermit, boundBps: bigint, deadline: bigint) {
  return {
    address: contract(network),
    abi: mezoRouteLeverageAbi,
    functionName: "close",
    args: [{ maxBtcToPool: q.maxBtcToPool, maxDeviationBps: boundBps, deadline }, auth, permit],
  } as const;
}

export function buildLeverageCall(
  network: NetworkConfig,
  q: LeverageQuote,
  auth: TroveAuth,
  permit: ExecutorPermit,
  minCollateralRatio: bigint,
  boundBps: bigint,
  deadline: bigint,
) {
  return {
    address: contract(network),
    abi: mezoRouteLeverageAbi,
    functionName: "leverage",
    args: [
      { btcToAdd: q.btcToAdd, debtIncrease: q.debtIncrease, maxMusdToPool: q.maxMusdToPool, minCollateralRatio, maxDeviationBps: boundBps, deadline },
      auth,
      permit,
    ],
  } as const;
}

export function buildOpenCall(
  network: NetworkConfig,
  q: OpenQuote,
  auth: TroveAuth,
  permit: ExecutorPermit,
  minCollateralRatio: bigint,
  boundBps: bigint,
  deadline: bigint,
) {
  return {
    address: contract(network),
    abi: mezoRouteLeverageAbi,
    functionName: "openLeveraged",
    args: [
      { btcToFlash: q.btcToFlash, debtAmount: q.debtAmount, maxMusdToPool: q.maxMusdToPool, minCollateralRatio, maxDeviationBps: boundBps, deadline },
      auth,
      permit,
    ],
    value: q.btcFromUser,
  } as const;
}

// Direct BorrowerOperations calls from the wallet (any wallet type).

export function refinanceCall(network: NetworkConfig, hints: { upperHint: Address; lowerHint: Address }) {
  return {
    address: network.addresses.borrowerOperations,
    abi: borrowerOperationsAbi,
    functionName: "refinance",
    args: [hints.upperHint, hints.lowerHint],
  } as const;
}

export function claimCollateralCall(network: NetworkConfig) {
  return { address: network.addresses.borrowerOperations, abi: borrowerOperationsAbi, functionName: "claimCollateral", args: [] } as const;
}

export function repayCall(network: NetworkConfig, amount: bigint, hints: { upperHint: Address; lowerHint: Address }) {
  return {
    address: network.addresses.borrowerOperations,
    abi: borrowerOperationsAbi,
    functionName: "repayMUSD",
    args: [amount, hints.upperHint, hints.lowerHint],
  } as const;
}
