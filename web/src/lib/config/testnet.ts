import type { Address } from "viem";

/** Mezo testnet deployment (PRODUCT_SPEC.md §11.1, §20). Every address the app calls is pinned here. */
export const testnet = {
  chainId: 31611,
  rpcUrl: "https://rpc.test.mezo.org",
  explorerUrl: "https://explorer.test.mezo.org",
  faucetUrl: "https://faucet.test.mezo.org",
  /** Fee the executor was deployed with; the app refuses to enter if the chain disagrees. */
  executorFeeBps: 10n,
  addresses: {
    musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
    btc: "0x7b7C000000000000000000000000000000000000",
    router: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
    poolFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
    pool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
    executor: "0xB36B2E012003840951CFf00fA6b1E3237A110920",
  },
} as const satisfies {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  executorFeeBps: bigint;
  addresses: Record<string, Address>;
};

export function explorerTxUrl(hash: string): string {
  return `${testnet.explorerUrl}/tx/${hash}`;
}
