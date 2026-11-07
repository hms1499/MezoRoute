import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import { borrowDomain } from "@/lib/trove/borrow-signature";

// BorrowerOperationsSignatures' type strings (mezo-org/musd); every authorisation names the borrower
// as recipient (spec L1: the recipient is always the user).

export const ADJUST_TYPES = {
  AdjustTrove: [
    { name: "collWithdrawal", type: "uint256" },
    { name: "debtChange", type: "uint256" },
    { name: "isDebtIncrease", type: "bool" },
    { name: "assetAmount", type: "uint256" },
    { name: "borrower", type: "address" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const CLOSE_TYPES = {
  CloseTrove: [
    { name: "borrower", type: "address" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const OPEN_TYPES = {
  OpenTrove: [
    { name: "assetAmount", type: "uint256" },
    { name: "debtAmount", type: "uint256" },
    { name: "borrower", type: "address" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** `assetAmount` is the BTC the contract sends with the call (msg.value): 0 for Unwind, `btcToAdd` for Leverage. */
export function adjustTypedData(input: {
  network: NetworkConfig;
  borrower: Address;
  collWithdrawal: bigint;
  debtChange: bigint;
  isDebtIncrease: boolean;
  assetAmount: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: borrowDomain(input.network),
    types: ADJUST_TYPES,
    primaryType: "AdjustTrove" as const,
    message: {
      collWithdrawal: input.collWithdrawal,
      debtChange: input.debtChange,
      isDebtIncrease: input.isDebtIncrease,
      assetAmount: input.assetAmount,
      borrower: input.borrower,
      recipient: input.borrower,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}

export function closeTypedData(input: { network: NetworkConfig; borrower: Address; nonce: bigint; deadline: bigint }) {
  return {
    domain: borrowDomain(input.network),
    types: CLOSE_TYPES,
    primaryType: "CloseTrove" as const,
    message: { borrower: input.borrower, recipient: input.borrower, nonce: input.nonce, deadline: input.deadline },
  };
}

/** `assetAmount` is the whole collateral: the wallet's BTC plus the flashed BTC. */
export function openTypedData(input: {
  network: NetworkConfig;
  borrower: Address;
  assetAmount: bigint;
  debtAmount: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: borrowDomain(input.network),
    types: OPEN_TYPES,
    primaryType: "OpenTrove" as const,
    message: {
      assetAmount: input.assetAmount,
      debtAmount: input.debtAmount,
      borrower: input.borrower,
      recipient: input.borrower,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}
