import { describe, expect, it } from "vitest";
import type { HistoryClient } from "@/lib/compare/history";
import { networks } from "@/lib/config/networks";
import { loadMainnetReference } from "./load";

const VAULT = networks.mainnet.savingsVault!.address;
// 13 Nov: supply, yieldIndex; isAlive, rewardRate, periodFinish, staked.
const SAVINGS_RESULTS = [1_323_505_568_564_574_227_223_293n, 218_681_915_228_140_081n, true, 805_620_943_026_785_549n, 1_795_046_400n, 151_023_584_600_783_358_698_787n];

const HEAD_RESULTS = [
  [1_252_333_046_250_689_046n, 101_720_411_561_710_585_148_464n, 1_792_028_034n],
  356_914_278_883_031_761_432n,
  30n,
  81_669_799_990_000_000_000_000n,
  29_871_966_506_620_911_511_760_946n,
  14_172_031_977_066_897_384_115_018n,
  14_172_031_977_066_897_103_661_470n,
  18_000_000_000_000_000_000_000_000n,
];

/** Head reads have no blockNumber; F6's history reads always pass one. */
function client(options: { headFails?: boolean; historyFails?: boolean; savingsFails?: boolean }): HistoryClient {
  return {
    async getBlock() {
      if (options.historyFails) throw new Error("missing trie node");
      throw new Error("unexpected history read");
    },
    async multicall({ blockNumber, contracts }) {
      if (blockNumber !== undefined) throw new Error("unexpected history multicall");
      if ((contracts[0] as { address: string }).address === VAULT) {
        if (options.savingsFails) throw new Error("vault reverted");
        return SAVINGS_RESULTS;
      }
      if (options.headFails) throw new Error("fetch failed");
      return HEAD_RESULTS;
    },
  };
}

describe("loadMainnetReference", () => {
  it("keeps the head figures when the history fails (no archive state, timeout)", async () => {
    const data = await loadMainnetReference(client({ historyFails: true }));
    expect(data.backtests).toBeNull();
    expect(data.reference.spDeposits).toBe(14_172_031_977_066_897_384_115_018n);
  });

  it("returns no history when the history read fails", async () => {
    const data = await loadMainnetReference(client({ historyFails: true }));
    expect(data.history).toBeNull();
  });

  it("rejects when the head read fails, so the card shows its unavailable state", async () => {
    await expect(loadMainnetReference(client({ headFails: true, historyFails: true }))).rejects.toThrow("fetch failed");
  });

  it("times out a hanging head read", async () => {
    const hanging: HistoryClient = { getBlock: () => new Promise(() => {}), multicall: () => new Promise(() => {}) };
    await expect(loadMainnetReference(hanging, 10)).rejects.toThrow("Timed out");
  });
});

describe("the Savings Vault in Mainnet today (U19)", () => {
  it("keeps the card when the vault cannot be read", async () => {
    const data = await loadMainnetReference(client({ historyFails: true, savingsFails: true }));
    expect(data.reference.spDeposits).toBe(14_172_031_977_066_897_384_115_018n);
    expect(data.savings).toBeNull();
  });

  it("reads the vault's supply and what is staked for MEZO; no 30-day yield without history", async () => {
    const data = await loadMainnetReference(client({ historyFails: true }));
    expect(data.savings).toEqual({ supply: SAVINGS_RESULTS[0], staked: SAVINGS_RESULTS[5], ret: null, seconds: null });
  });
});
