import type { Address } from "viem";

export type NetworkId = "testnet" | "mainnet";

/** Every contract the app reads or calls (PRODUCT_SPEC.md §11.1): the allowlist. */
export type NetworkAddresses = {
  musd: Address;
  btc: Address;
  router: Address;
  poolFactory: Address;
  pool: Address;
  borrowerOperationsSignatures: Address;
  borrowerOperations: Address;
  troveManager: Address;
  priceFeed: Address;
  hintHelpers: Address;
  sortedTroves: Address;
  stabilityPool: Address;
};

export type NetworkConfig = {
  id: NetworkId;
  chainId: 31611 | 31612;
  name: "Mezo Testnet" | "Mezo Mainnet";
  explorerUrl: string;
  faucetUrl: string | null;
  mezoAppUrl: string;
  /** Pinned executor and its fee (F3 compares the fee with the chain before writing); null until deployed. */
  executor: { address: Address; feeBps: bigint } | null;
  addresses: NetworkAddresses;
};

/** Mezo networks (PRODUCT_SPEC.md §11.1, §20). Pure modules take one of these instead of importing a network. */
export const networks: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    chainId: 31611,
    name: "Mezo Testnet",
    explorerUrl: "https://explorer.test.mezo.org",
    faucetUrl: "https://faucet.test.mezo.org",
    mezoAppUrl: "https://testnet.mezo.org",
    executor: { address: "0xB36B2E012003840951CFf00fA6b1E3237A110920", feeBps: 10n },
    addresses: {
      musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      btc: "0x7b7C000000000000000000000000000000000000",
      router: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
      poolFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
      pool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
      borrowerOperationsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
      borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
      troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
      priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
      hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
      sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
      stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
    },
  },
  mainnet: {
    id: "mainnet",
    chainId: 31612,
    name: "Mezo Mainnet",
    explorerUrl: "https://explorer.mezo.org",
    faucetUrl: null,
    mezoAppUrl: "https://mezo.org",
    // Deployed in M1 with a 1,000 MUSD cap; until then mainnet is read-only.
    executor: null,
    addresses: {
      musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
      btc: "0x7b7C000000000000000000000000000000000000",
      router: "0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706",
      poolFactory: "0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248",
      pool: "0x52e604c44417233b6CcEDDDc0d640A405Caacefb",
      borrowerOperationsSignatures: "0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a",
      borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
      troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
      priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
      hintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
      sortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
      stabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32",
    },
  },
};

export function explorerTxUrl(network: NetworkConfig, hash: string): string {
  return `${network.explorerUrl}/tx/${hash}`;
}
