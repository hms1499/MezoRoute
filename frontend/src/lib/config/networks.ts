import type { Address, Hex } from "viem";

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

/** A MezoRoute contract deployment (U19 Proof): immutable, so its creation transaction and UTC date are constants. */
export type Deployment = { address: Address; deployBlock: bigint; deployTx: Hex; deployedAt: string };

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
  executor: (Deployment & { feeBps: bigint }) | null;
  /** Earlier executor deployments, scanned for history only (F7 cost basis); never called. */
  legacyExecutors: Deployment[];
  /** The executor's per-transaction MUSD cap (`contracts/script/Deploy.s.sol` `maxMusdInFor`); the route pages read it from chain. */
  entryCap: bigint;
  /** The executor's per-transaction BTC cap (`maxBtcInFor`). */
  entryCapBtc: bigint;
  /**
   * MezoRouteLeverage (L1): Unwind, Close, Leverage and Open with leverage; its fee (Leverage and Open
   * only) and per-transaction caps (`contracts/script/DeployLeverage.s.sol`); null until deployed.
   */
  leverage: (Deployment & { feeBps: bigint; maxBtcFlash: bigint; maxMusdFlash: bigint }) | null;
  /** The pool's Tigris gauge and the voter that says whether it is alive; null when the network has none. */
  gauge: { address: Address; voter: Address } | null;
  /** CL pool that prices MEZO in MUSD (display only); null when none exists (testnet). */
  mezoPricePool: { address: Address; mezoIsToken0: boolean } | null;
  /** U19 Proof: wallets the team runs; every other caller of our contracts is shown as "outside". */
  teamWallets: readonly Address[];
  /**
   * U19: Mezo's MUSD Savings Vault (sMUSD, `MUSDSavingsRate`) and its MEZO gauge, compared read-only. Staked sMUSD
   * belongs to the gauge, so its MUSD yield goes to the gauge, not the staker. Null gauge: the network has none.
   */
  savingsVault: { address: Address; gauge: Address | null } | null;
  addresses: NetworkAddresses;
};

// The team's own wallets (U19): the user's MetaMask and the deployer on both networks, plus the user's Unisat Safe on testnet.
const TEAM = ["0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8", "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49"] as const satisfies readonly Address[];

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
    executor: {
      address: "0x1281cC769c136F9F4f291B390c8992a3Cd556288",
      feeBps: 10n,
      deployBlock: 16_569_977n,
      deployTx: "0x5346cb0a04fcc4d86e63a1a133ec53f1d7a7f1064fea9c5c397cbbfd695f9fb9",
      deployedAt: "2026-11-04",
    },
    legacyExecutors: [
      {
        address: "0xB36B2E012003840951CFf00fA6b1E3237A110920",
        deployBlock: 15_903_010n,
        deployTx: "0x060ae9ed9c8e30db6327457b710f3263e0e4ad89394fed734a17a5f8c4d51fb3",
        deployedAt: "2026-10-02",
      },
    ],
    entryCap: 1_000_000n * 10n ** 18n,
    entryCapBtc: 12n * 10n ** 18n,
    leverage: {
      address: "0x14bEdE8de5Cc60342492934B207Ce99eAf986d88",
      deployBlock: 16_622_070n,
      deployTx: "0x22c07ba40588a0fca71b29b8cd5d507843db83fd562fae75f431d12744ae31db",
      deployedAt: "2026-11-07",
      feeBps: 10n,
      maxBtcFlash: 12n * 10n ** 18n,
      maxMusdFlash: 1_000_000n * 10n ** 18n,
    },
    gauge: { address: "0x72D88B0795373437E86792DEd8362D66dC43Cd2c", voter: "0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D" },
    mezoPricePool: null,
    teamWallets: [...TEAM, "0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D"],
    // The testnet vault the Mezo app deposits into: 596 deposits from 190 depositors by 13 Nov (the other vault on our MUSD has 5). No gauge.
    savingsVault: { address: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16", gauge: null },
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
    executor: {
      address: "0xb3461B35577cD2aC5ccb6d71e7f89a16bE257915",
      feeBps: 10n,
      deployBlock: 13_031_359n,
      deployTx: "0x4338b6c8024f0516d66bbe5a96ec8e30b012c30be8e5e397673f279cb167bbe8",
      deployedAt: "2026-11-06",
    },
    // M1 V1 (15 Oct 2026): scanned for history only; its LP can still exit.
    legacyExecutors: [
      {
        address: "0x046449b1229C863e278f369869BA10e12bd80d9E",
        deployBlock: 12_524_142n,
        deployTx: "0x8aa55418f1da98ea1700c9e950f01d8cadf94fc34633650f5e60f9e68aafb71d",
        deployedAt: "2026-10-15",
      },
    ],
    entryCap: 1_000n * 10n ** 18n,
    entryCapBtc: 125n * 10n ** 14n,
    // L1, 7 Nov 2026: deployed from the keystore, every immutable read back; caps 0.0125 BTC / 2,500 MUSD per call.
    leverage: {
      address: "0xA82059CEaAa50678e0295610106c46D0bd26F6C6",
      deployBlock: 13_064_669n,
      deployTx: "0xd38ed08ce7f778122cc44173151e16eb6c8aa6a6e6873f2aa943323214076048",
      deployedAt: "2026-11-07",
      feeBps: 10n,
      maxBtcFlash: 125n * 10n ** 14n,
      maxMusdFlash: 2_500n * 10n ** 18n,
    },
    gauge: { address: "0x8Be20a5fF57E381025aE5E3A121B697269569AaF", voter: "0x48233cCC97B87Ba93bCA212cbEe48e3210211f03" },
    mezoPricePool: { address: "0x1D6e8D24c133535F2d00676F66a0e824f84765ff", mezoIsToken0: true },
    teamWallets: TEAM,
    // "MUSD Savings Rate" (proxy, implementation MUSDSavingsRate, verified) and its MEZO gauge in the pools' voter (checked 13 Nov).
    savingsVault: { address: "0xb4D498029af77680cD1eF828b967f010d06C51CC", gauge: "0x677817bF3e44b90E8F95222F75e2950b7904a401" },
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
