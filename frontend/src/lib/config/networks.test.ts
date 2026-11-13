import { mezoMainnet, mezoTestnet } from "@mezo-org/orangekit";
import { getAddress, isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { explorerAddressUrl, explorerTxUrl, networks } from "./networks";

describe("networks", () => {
  // Passport re-exports these from OrangeKit; importing Passport itself needs `window`.
  it("uses the chain ids Passport's Bitcoin connectors are bound to", () => {
    expect(networks.testnet.chainId).toBe(mezoTestnet.id);
    expect(networks.mainnet.chainId).toBe(mezoMainnet.id);
    expect([networks.testnet.chainId, networks.mainnet.chainId]).toEqual([31611, 31612]);
  });

  it("reads through the RPCs Passport's chains use (viem's rpc.mezo.org has no DNS record)", () => {
    expect(networks.testnet.rpcUrl).toBe(mezoTestnet.rpcUrls.default.http[0]);
    expect(networks.mainnet.rpcUrl).toBe(mezoMainnet.rpcUrls.default.http[0]);
    expect([networks.testnet.rpcUrl, networks.mainnet.rpcUrl]).toEqual(["https://rpc.test.mezo.org", "https://rpc-internal.mezo.org"]);
  });

  it.each(
    Object.values(networks).flatMap((network) =>
      Object.entries(network.addresses).map(([name, address]) => [`${network.id} ${name}`, address] as const),
    ),
  )("%s is a checksummed address", (_name, address) => {
    expect(isAddress(address, { strict: true })).toBe(true);
    expect(getAddress(address)).toBe(address);
  });

  it("pins the executor's per-transaction entry cap per network (Deploy.s.sol maxMusdInFor)", () => {
    expect(networks.testnet.entryCap).toBe(1_000_000n * 10n ** 18n);
    expect(networks.mainnet.entryCap).toBe(1_000n * 10n ** 18n);
  });

  it("pins MezoRouteLeverage per network (L1; DeployLeverage.s.sol caps)", () => {
    expect(networks.testnet.leverage).toMatchObject({
      address: "0x14bEdE8de5Cc60342492934B207Ce99eAf986d88",
      deployBlock: 16_622_070n,
      feeBps: 10n,
      maxBtcFlash: 12n * 10n ** 18n,
      maxMusdFlash: 1_000_000n * 10n ** 18n,
    });
    // Deployed 7 Nov 2026 from the keystore, every immutable read back (deploy-leverage.sh).
    expect(networks.mainnet.leverage).toMatchObject({
      address: "0xA82059CEaAa50678e0295610106c46D0bd26F6C6",
      deployBlock: 13_064_669n,
      feeBps: 10n,
      maxBtcFlash: 125n * 10n ** 14n,
      maxMusdFlash: 2_500n * 10n ** 18n,
    });
  });

  it("pins the CollSurplusPool read back from BorrowerOperationsSignatures (L1)", () => {
    expect(networks.testnet.addresses.collSurplusPool).toBe("0xB4C35747c26E4aB5F1a7CdC7E875B5946eFa6fa9");
    expect(networks.mainnet.addresses.collSurplusPool).toBe("0xBF51807ACb3394B8550f0554FB9098856Ef5F491");
  });

  it("pins the testnet executor's 10 bps fee (spec 11.1)", () => {
    expect(networks.testnet.executor?.feeBps).toBe(10n);
  });

  it("runs V2 on mainnet and keeps the M1 V1 for history (G1)", () => {
    expect(networks.mainnet.executor).toMatchObject({
      address: "0xb3461B35577cD2aC5ccb6d71e7f89a16bE257915",
      feeBps: 10n,
      deployBlock: 13_031_359n,
    });
    expect(networks.mainnet.legacyExecutors).toMatchObject([{ address: "0x046449b1229C863e278f369869BA10e12bd80d9E", deployBlock: 12_524_142n }]);
  });

  it("offers a faucet on testnet only", () => {
    expect(networks.testnet.faucetUrl).toBe("https://faucet.test.mezo.org");
    expect(networks.mainnet.faucetUrl).toBeNull();
  });

  it("builds explorer transaction links per network", () => {
    expect(explorerTxUrl(networks.testnet, "0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
    expect(explorerTxUrl(networks.mainnet, "0xabc")).toBe("https://explorer.mezo.org/tx/0xabc");
  });

  it("links an address on each network's explorer", () => {
    expect(explorerAddressUrl(networks.mainnet, "0x046449b1229C863e278f369869BA10e12bd80d9E")).toBe(
      "https://explorer.mezo.org/address/0x046449b1229C863e278f369869BA10e12bd80d9E",
    );
    expect(explorerAddressUrl(networks.testnet, "0xB36B2E012003840951CFf00fA6b1E3237A110920")).toBe(
      "https://explorer.test.mezo.org/address/0xB36B2E012003840951CFf00fA6b1E3237A110920",
    );
  });

  it("pins the gauge and voter per network (G1 spec chain facts)", () => {
    expect(networks.testnet.gauge).toEqual({
      address: "0x72D88B0795373437E86792DEd8362D66dC43Cd2c",
      voter: "0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D",
    });
    expect(networks.mainnet.gauge).toEqual({
      address: "0x8Be20a5fF57E381025aE5E3A121B697269569AaF",
      voter: "0x48233cCC97B87Ba93bCA212cbEe48e3210211f03",
    });
  });

  it("prices MEZO only on mainnet, from the CL pool where MEZO is token0", () => {
    expect(networks.testnet.mezoPricePool).toBeNull();
    expect(networks.mainnet.mezoPricePool).toEqual({
      address: "0x1D6e8D24c133535F2d00676F66a0e824f84765ff",
      mezoIsToken0: true,
    });
    expect(networks.mainnet.addresses.mezo).toBe("0x7B7c000000000000000000000000000000000001");
  });

  it("pins the BTC entry cap per network (Deploy.s.sol maxBtcInFor)", () => {
    expect(networks.testnet.entryCapBtc).toBe(12n * 10n ** 18n);
    expect(networks.mainnet.entryCapBtc).toBe(125n * 10n ** 14n);
  });

  it("runs V2 on testnet and keeps V1 for history", () => {
    expect(networks.testnet.executor).toMatchObject({
      address: "0x1281cC769c136F9F4f291B390c8992a3Cd556288",
      feeBps: 10n,
      deployBlock: 16_569_977n,
    });
    expect(networks.testnet.legacyExecutors).toMatchObject([{ address: "0xB36B2E012003840951CFf00fA6b1E3237A110920", deployBlock: 15_903_010n }]);
  });
});

describe("U19 proof and savings config", () => {
  it("pins every deployment's transaction and date", () => {
    const m = networks.mainnet;
    const t = networks.testnet;
    expect([m.executor?.deployTx, m.executor?.deployedAt]).toEqual(["0x4338b6c8024f0516d66bbe5a96ec8e30b012c30be8e5e397673f279cb167bbe8", "2026-11-06"]);
    expect([m.legacyExecutors[0].deployTx, m.legacyExecutors[0].deployedAt]).toEqual(["0x8aa55418f1da98ea1700c9e950f01d8cadf94fc34633650f5e60f9e68aafb71d", "2026-10-15"]);
    expect([m.leverage?.deployTx, m.leverage?.deployedAt]).toEqual(["0xd38ed08ce7f778122cc44173151e16eb6c8aa6a6e6873f2aa943323214076048", "2026-11-07"]);
    expect([t.executor?.deployTx, t.executor?.deployedAt]).toEqual(["0x5346cb0a04fcc4d86e63a1a133ec53f1d7a7f1064fea9c5c397cbbfd695f9fb9", "2026-11-04"]);
    expect([t.legacyExecutors[0].deployTx, t.legacyExecutors[0].deployedAt]).toEqual(["0x060ae9ed9c8e30db6327457b710f3263e0e4ad89394fed734a17a5f8c4d51fb3", "2026-10-02"]);
    expect([t.leverage?.deployTx, t.leverage?.deployedAt]).toEqual(["0x22c07ba40588a0fca71b29b8cd5d507843db83fd562fae75f431d12744ae31db", "2026-11-07"]);
  });

  it("lists the team's wallets per network", () => {
    const lower = (list: readonly string[]) => list.map((a) => a.toLowerCase());
    const both = ["0x375aaa9e9e70e36f42d5414ec10b46b847f6d6e8", "0xd74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49"];
    expect(lower(networks.mainnet.teamWallets)).toEqual(both);
    expect(lower(networks.testnet.teamWallets)).toEqual([...both, "0x4543ba6e0d1cc63b9eda1d1e61853a59cf2ae22d"]);
  });

  it("points at the live savings vaults", () => {
    expect(networks.mainnet.savingsVault).toEqual({
      address: "0xb4D498029af77680cD1eF828b967f010d06C51CC",
      gauge: "0x677817bF3e44b90E8F95222F75e2950b7904a401",
    });
    expect(networks.testnet.savingsVault).toEqual({ address: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16", gauge: null });
  });
});
