import { describe, expect, it } from "vitest";
import type { HistoryClient } from "@/lib/compare/history";
import { loadMainnetReference } from "./load";

const HEAD_RESULTS = [
  [1_252_333_046_250_689_046n, 101_720_411_561_710_585_148_464n, 1_792_028_034n],
  356_914_278_883_031_761_432n,
  30n,
  81_669_799_990_000_000_000_000n,
  29_871_966_506_620_911_511_760_946n,
  14_172_031_977_066_897_384_115_018n,
];

/** Head reads have no blockNumber; F6's history reads always pass one. */
function client(options: { headFails?: boolean; historyFails?: boolean }): HistoryClient {
  return {
    async getBlock() {
      if (options.historyFails) throw new Error("missing trie node");
      throw new Error("unexpected history read");
    },
    async multicall({ blockNumber }) {
      if (blockNumber !== undefined) throw new Error("unexpected history multicall");
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

  it("rejects when the head read fails, so the card shows its unavailable state", async () => {
    await expect(loadMainnetReference(client({ headFails: true, historyFails: true }))).rejects.toThrow("fetch failed");
  });

  it("times out a hanging head read", async () => {
    const hanging: HistoryClient = { getBlock: () => new Promise(() => {}), multicall: () => new Promise(() => {}) };
    await expect(loadMainnetReference(hanging, 10)).rejects.toThrow("Timed out");
  });
});
