import { parseSignature, type Address, type Hex } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import type { ExecutorPermit } from "./params";

/**
 * MUSD's EIP-712 domain, from `eip712Domain()` on testnet (5 Oct 2026): name "Mezo USD", version
 * "1". Check mainnet's `eip712Domain()` before M1 enables mainnet writes.
 */
export function musdPermitDomain(network: NetworkConfig) {
  return {
    name: "Mezo USD",
    version: "1",
    chainId: network.chainId,
    verifyingContract: network.addresses.musd,
  } as const;
}

export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** EIP-2612 permit for exactly `value` MUSD to the executor (FR-06). */
export function permitTypedData(input: {
  network: NetworkConfig;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: musdPermitDomain(input.network),
    types: PERMIT_TYPES,
    primaryType: "Permit" as const,
    message: {
      owner: input.owner,
      spender: input.spender,
      value: input.value,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}

export function toExecutorPermit(signature: Hex, value: bigint, deadline: bigint): ExecutorPermit {
  const { r, s, v, yParity } = parseSignature(signature);
  return { value, deadline, v: Number(v ?? BigInt(yParity + 27)), r, s };
}

/** A permit is sent only with a minute to spare, so it cannot expire while the transaction is pending. */
export const PERMIT_MARGIN_SECONDS = 60n;

export function permitUsable(permit: ExecutorPermit, nowSeconds: bigint): boolean {
  return nowSeconds + PERMIT_MARGIN_SECONDS < permit.deadline;
}
