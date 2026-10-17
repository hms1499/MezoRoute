import type { Address, Hex } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";

/** BorrowerOperationsSignatures' EIP-712 domain (verified on testnet, 30 Sep and 2 Oct 2026). */
export function borrowDomain(network: NetworkConfig) {
  return {
    name: "BorrowerOperationsSignatures",
    version: "1",
    chainId: network.chainId,
    verifyingContract: network.addresses.borrowerOperationsSignatures,
  } as const;
}

export const BORROW_TYPES = {
  WithdrawMUSD: [
    { name: "amount", type: "uint256" },
    { name: "borrower", type: "address" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** The borrow authorisation; the recipient is always the borrower (spec §11.4). */
export function borrowTypedData(input: {
  network: NetworkConfig;
  borrower: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: borrowDomain(input.network),
    types: BORROW_TYPES,
    primaryType: "WithdrawMUSD" as const,
    message: {
      amount: input.amount,
      borrower: input.borrower,
      recipient: input.borrower,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}

export type BorrowAuthorisation = { amount: bigint; nonce: bigint; deadline: bigint; signature: Hex };

/** Like a permit, a borrow authorisation is sent only with a minute to spare. */
export const BORROW_MARGIN_SECONDS = 60n;

/**
 * Whether a signed authorisation can still be sent: "used" when the borrower's nonce has moved (it
 * was submitted elsewhere, so the MUSD is already in the wallet), "expired" inside the last minute.
 */
export function borrowAuthorisationState(
  auth: BorrowAuthorisation,
  nowSeconds: bigint,
  chainNonce: bigint,
): "usable" | "expired" | "used" {
  if (chainNonce !== auth.nonce) return "used";
  if (nowSeconds + BORROW_MARGIN_SECONDS >= auth.deadline) return "expired";
  return "usable";
}
