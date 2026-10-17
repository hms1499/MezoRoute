import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import { PERMIT_TYPES } from "@/lib/routes/musd-btc-lp/permit";

/**
 * The LP token's EIP-712 domain. Tigris pools are OpenZeppelin `ERC20Permit("")`: `eip712Domain()`
 * returns name "" and version "1" (testnet, 12 Oct 2026). Check mainnet before M1.
 */
export function lpPermitDomain(network: NetworkConfig) {
  return { name: "", version: "1", chainId: network.chainId, verifyingContract: network.addresses.pool } as const;
}

/** EIP-2612 permit for exactly `value` LP to the executor (Flow G step 3). */
export function lpPermitTypedData(input: {
  network: NetworkConfig;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: lpPermitDomain(input.network),
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
