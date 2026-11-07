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
  multicall3: Address;
  /** MEZO, the gauge's reward token. */
  mezo: Address;
  /** The protocol's own Stability Pool depositor (`BorrowerOperations.pcv()`); the dashboard shows its share. */
  pcv: Address;
  /** Holds BTC left after a redemption or liquidation closed a Trove (`BorrowerOperationsSignatures.collSurplusPoolAddress()`). */
  collSurplusPool: Address;
};

export type NetworkConfig = {
  id: NetworkId;
  chainId: 31611 | 31612;
  name: "Mezo Testnet" | "Mezo Mainnet";
  /** JSON-RPC endpoint Passport's chain uses; the mainnet reference card and the quote-accuracy script read through it. */
  rpcUrl: string;
  explorerUrl: string;
  /** The explorer's Blockscout API (F5 reads Stability Pool history from it; the frontend host serves no API). */
  explorerApiUrl: string;
  faucetUrl: string | null;
  mezoAppUrl: string;
  /**
   * Pinned executor, its fee (F3 compares the fee with the chain before writing), and its deployment
   * block (F7 scans its events from there); null until deployed.
   */
  executor: { address: Address; feeBps: bigint; deployBlock: bigint } | null;
  /** Earlier executor deployments, scanned for history only (F7 cost basis); never called. */
  legacyExecutors: { address: Address; deployBlock: bigint }[];
  /** The executor's per-transaction MUSD cap (`contracts/script/Deploy.s.sol` `maxMusdInFor`); the route pages read it from chain. */
  entryCap: bigint;
  /** The executor's per-transaction BTC cap (`maxBtcInFor`). */
  entryCapBtc: bigint;
  /**
   * MezoRouteLeverage (L1): Unwind, Close, Leverage and Open with leverage; its fee (Leverage and Open
   * only) and per-transaction caps (`contracts/script/DeployLeverage.s.sol`); null until deployed.
   */
  leverage: { address: Address; deployBlock: bigint; feeBps: bigint; maxBtcFlash: bigint; maxMusdFlash: bigint } | null;
  /** The pool's Tigris gauge and the voter that says whether it is alive; null when the network has none. */
  gauge: { address: Address; voter: Address } | null;
  /** CL pool that prices MEZO in MUSD (display only); null when none exists (testnet). */
  mezoPricePool: { address: Address; mezoIsToken0: boolean } | null;
  addresses: NetworkAddresses;
};

/** Mezo networks (PRODUCT_SPEC.md §11.1, §20). Pure modules take one of these instead of importing a network. */
export const networks: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    chainId: 31611,
    name: "Mezo Testnet",
    rpcUrl: "https://rpc.test.mezo.org",
    explorerUrl: "https://explorer.test.mezo.org",
    explorerApiUrl: "https://api.explorer.test.mezo.org",
    faucetUrl: "https://faucet.test.mezo.org",
    mezoAppUrl: "https://testnet.mezo.org",
    // G1: V2 (stake flag, enterFromBtc), deployed at block 16,569,977.
    executor: { address: "0x1281cC769c136F9F4f291B390c8992a3Cd556288", feeBps: 10n, deployBlock: 16_569_977n },
    legacyExecutors: [{ address: "0xB36B2E012003840951CFf00fA6b1E3237A110920", deployBlock: 15_903_010n }],
    entryCap: 1_000_000n * 10n ** 18n,
    entryCapBtc: 12n * 10n ** 18n,
    leverage: {
      address: "0x14bEdE8de5Cc60342492934B207Ce99eAf986d88",
      deployBlock: 16_622_070n,
      feeBps: 10n,
      maxBtcFlash: 12n * 10n ** 18n,
      maxMusdFlash: 1_000_000n * 10n ** 18n,
    },
    gauge: { address: "0x72D88B0795373437E86792DEd8362D66dC43Cd2c", voter: "0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D" },
    mezoPricePool: null,
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
      // Multicall3 (same address on both networks; Passport's chains declare it).
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
      mezo: "0x7B7c000000000000000000000000000000000001",
      pcv: "0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af",
      collSurplusPool: "0xB4C35747c26E4aB5F1a7CdC7E875B5946eFa6fa9",
    },
  },
  mainnet: {
    id: "mainnet",
    chainId: 31612,
    name: "Mezo Mainnet",
    rpcUrl: "https://rpc-internal.mezo.org",
    explorerUrl: "https://explorer.mezo.org",
    explorerApiUrl: "https://api.explorer.mezo.org",
    faucetUrl: null,
    mezoAppUrl: "https://mezo.org",
    // G1, 6 Nov 2026: V2 (stake flag, enterFromBtc), 1,000 MUSD and 0.0125 BTC caps per entry, source-verified on the explorer.
    executor: { address: "0xb3461B35577cD2aC5ccb6d71e7f89a16bE257915", feeBps: 10n, deployBlock: 13_031_359n },
    // M1 V1 (15 Oct 2026): scanned for history only; its LP can still exit.
    legacyExecutors: [{ address: "0x046449b1229C863e278f369869BA10e12bd80d9E", deployBlock: 12_524_142n }],
    entryCap: 1_000n * 10n ** 18n,
    entryCapBtc: 125n * 10n ** 14n,
    // L1, 7 Nov 2026: deployed from the keystore, every immutable read back; caps 0.0125 BTC / 2,500 MUSD per call.
    leverage: {
      address: "0xA82059CEaAa50678e0295610106c46D0bd26F6C6",
      deployBlock: 13_064_669n,
      feeBps: 10n,
      maxBtcFlash: 125n * 10n ** 14n,
      maxMusdFlash: 2_500n * 10n ** 18n,
    },
    gauge: { address: "0x8Be20a5fF57E381025aE5E3A121B697269569AaF", voter: "0x48233cCC97B87Ba93bCA212cbEe48e3210211f03" },
    mezoPricePool: { address: "0x1D6e8D24c133535F2d00676F66a0e824f84765ff", mezoIsToken0: true },
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
      // Multicall3 (same address on both networks; Passport's chains declare it).
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
      mezo: "0x7B7c000000000000000000000000000000000001",
      pcv: "0x391EcC7ffEFc48cff41D0F2Bb36e38b82180B993",
      collSurplusPool: "0xBF51807ACb3394B8550f0554FB9098856Ef5F491",
    },
  },
};

export function explorerTxUrl(network: NetworkConfig, hash: string): string {
  return `${network.explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(network: NetworkConfig, address: string): string {
  return `${network.explorerUrl}/address/${address}`;
}
