import { describe, expect, it } from "vitest";
import type { ExplorerLog } from "@/lib/stability-pool/explorer";
import { networks } from "@/lib/config/networks";
import fixtures from "./fixtures.json";
import { proofRows, type ProofSource } from "./rows";

// Live explorer logs (13 Nov 2026): mainnet Executor V2 and V1, the testnet Leverage round trip of 7 Nov, and a
// testnet Borrow & Deploy. Each test names the production rule that would break it.
const logs = (key: "mainnetV2" | "mainnetV1" | "testnetLeverage" | "testnetBorrow") => fixtures[key] as unknown as ExplorerLog[];
const mainnet = (sources: ProofSource[]) => proofRows(sources, networks.mainnet.teamWallets);
const testnet = (sources: ProofSource[]) => proofRows(sources, networks.testnet.teamWallets);
const byTx = (rows: ReturnType<typeof mainnet>, prefix: string) => rows.filter((row) => row.txHash.startsWith(prefix));

describe("proofRows", () => {
  const v2 = mainnet([{ contract: "Executor V2", logs: logs("mainnetV2") }]);

  it("reads a staked MUSD entry as one row", () => {
    const rows = byTx(v2, "0x415b5af4");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "enter", staked: true, label: "Enter, staked", result: "10 MUSD → 0.0179 LP", walletKind: "team" });
    expect(rows[0].time).toBeGreaterThan(0n);
  });

  it("reads exits, BTC entries, V1 entries, and outside wallets", () => {
    expect(byTx(v2, "0x730c33bd")[0]).toMatchObject({ action: "exit", label: "Exit", result: "0.0179 LP → 9.96 MUSD" });
    expect(byTx(v2, "0xeac5130e")[0]).toMatchObject({ action: "enterFromBtc", label: "Enter from BTC, staked", result: "0.00003 BTC → 0.0041 LP" });
    const outside = byTx(v2, "0x1713f067")[0];
    expect(outside).toMatchObject({ walletKind: "outside", label: "Enter, staked", result: "8 MUSD → 0.0146 LP" });
    expect(outside.wallet.toLowerCase()).toMatch(/^0xd204[0-9a-f]{32}190c$/);
    const v1 = mainnet([{ contract: "Executor V1", logs: logs("mainnetV1") }]);
    expect(v1[0]).toMatchObject({ contract: "Executor V1", action: "enter", staked: false, label: "Enter", result: "10 MUSD → 0.0174 LP" });
  });

  it("names Borrow & Deploy by its borrowed MUSD", () => {
    const [row] = testnet([{ contract: fixtures.borrowContract, logs: logs("testnetBorrow") }]);
    expect(row).toMatchObject({ action: "borrowAndDeploy", label: "Borrow & Deploy, staked", result: "300 MUSD → 0.5347 LP · borrowed 300 MUSD" });
  });

  it("reads the Leverage round trip, newest first", () => {
    const rows = testnet([{ contract: "Leverage", logs: logs("testnetLeverage") }]);
    expect(rows.map((row) => row.action)).toEqual(["close", "leverage", "unwind", "openLeveraged"]);
    expect(rows.map((row) => row.result)).toEqual([
      "repaid 2,685.75 MUSD · 0.076517 BTC back",
      "+0.009771 BTC · +776.89 MUSD debt",
      "repaid 793.73 MUSD · 0.010202 BTC out",
      "0.043 BTC in · borrowed 2,699.11 MUSD",
    ]);
    expect(rows[3].label).toBe("Open with leverage");
  });

  it("labels a Bitcoin wallet's Safe as its wallet", () => {
    const safe = "0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D";
    const [entered] = logs("testnetBorrow").filter((log) => log.topics.length > 0 && log.data.length > 200);
    const relayed = { ...entered, topics: [entered.topics[0], `0x000000000000000000000000${safe.slice(2).toLowerCase()}`, entered.topics[2], entered.topics[3]] } as ExplorerLog;
    const [row] = testnet([{ contract: "Executor V2", logs: [relayed] }]);
    expect(row.wallet.toLowerCase()).toBe(safe.toLowerCase());
    expect(row.walletKind).toBe("team");
  });

  it("ignores a lone Staked log and logs no ABI knows", () => {
    const staked = logs("mainnetV2").find((log) => log.transactionHash.startsWith("0x415b5af4") && log.data.length < 70)!;
    const unknown = { ...staked, transactionHash: "0x01", topics: ["0x1234", null, null, null] } as ExplorerLog;
    expect(mainnet([{ contract: "Executor V2", logs: [staked, unknown] }])).toEqual([]);
  });
});
