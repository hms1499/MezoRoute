import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import {
  historyKey,
  loadHistory,
  mergeHistory,
  parseHistory,
  readRanges,
  scanRanges,
  serializeHistory,
  type BlockRange,
  type HistoryEvent,
} from "./history";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const DEPLOY = 15_903_010n;

function entered(blockNumber: bigint, logIndex = 0): HistoryEvent {
  const event: EnteredEvent = {
    caller: ME,
    recipient: ME,
    musdBorrowed: 0n,
    musdIn: 20n,
    fee: 0n,
    musdSwapped: 10n,
    btcFromSwap: 1n,
    musdAdded: 10n,
    btcAdded: 1n,
    liquidityOut: 3n,
    musdRefund: 0n,
    btcRefund: 0n,
  };
  return { kind: "entered", blockNumber, logIndex, event };
}

describe("scanRanges", () => {
  it("splits into 10,000-block ranges that never end above the head", () => {
    // Mezo's RPC answers a range past the head with an empty list and no error (12 Oct 2026).
    expect(scanRanges(DEPLOY, 15_925_000n)).toEqual([
      { fromBlock: 15_903_010n, toBlock: 15_913_009n },
      { fromBlock: 15_913_010n, toBlock: 15_923_009n },
      { fromBlock: 15_923_010n, toBlock: 15_925_000n },
    ]);
  });

  it("covers a single block and nothing when the start is past the head", () => {
    expect(scanRanges(10n, 10n)).toEqual([{ fromBlock: 10n, toBlock: 10n }]);
    expect(scanRanges(11n, 10n)).toEqual([]);
  });
});

describe("readRanges", () => {
  const ranges: BlockRange[] = scanRanges(0n, 99n, 10n);

  it("reads at most `concurrency` ranges at once and returns events sorted by block and log", async () => {
    let active = 0;
    let peak = 0;
    const events = await readRanges(
      async (range) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return range.fromBlock === 50n ? [entered(55n, 2), entered(55n, 1)] : range.fromBlock === 10n ? [entered(12n)] : [];
      },
      ranges,
      3,
    );
    expect(peak).toBe(3);
    expect(events.map((item) => [item.blockNumber, item.logIndex])).toEqual([
      [12n, 0],
      [55n, 1],
      [55n, 2],
    ]);
  });

  it("retries a failing range, then gives up after three attempts", async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) throw new Error("rpc");
      return [entered(1n)];
    };
    await expect(readRanges(flaky, [{ fromBlock: 0n, toBlock: 9n }])).resolves.toHaveLength(1);
    await expect(readRanges(async () => Promise.reject(new Error("down")), [{ fromBlock: 0n, toBlock: 9n }])).rejects.toThrow("down");
  });
});

describe("mergeHistory", () => {
  it("caches only events at least REORG_MARGIN blocks below the head", () => {
    const { events, cache } = mergeHistory(null, [entered(900n), entered(980n)], 1_000n, 0n);
    expect(events.map((item) => item.blockNumber)).toEqual([900n, 980n]);
    expect(cache).toEqual({ scannedTo: 950n, events: [entered(900n)] });
  });

  it("keeps the old cache when the head has not moved past the margin", () => {
    const old = { scannedTo: 990n, events: [entered(900n)] };
    expect(mergeHistory(old, [entered(1_010n)], 1_020n, 0n)).toEqual({ events: [entered(900n), entered(1_010n)], cache: old });
  });
});

describe("loadHistory", () => {
  it("scans from the deployment block without a cache, from after the cache with one", async () => {
    const seen: BlockRange[] = [];
    const read = async (range: BlockRange) => {
      seen.push(range);
      return [];
    };
    await loadHistory({ read, head: DEPLOY + 5n, deployBlock: DEPLOY, cache: null });
    await loadHistory({ read, head: 2_000n, deployBlock: 0n, cache: { scannedTo: 1_500n, events: [] } });
    expect(seen).toEqual([
      { fromBlock: DEPLOY, toBlock: DEPLOY + 5n },
      { fromBlock: 1_501n, toBlock: 2_000n },
    ]);
  });

  it("rejects, and so writes no cache, when a range keeps failing", async () => {
    await expect(
      loadHistory({ read: async () => Promise.reject(new Error("down")), head: 100n, deployBlock: 0n, cache: null }),
    ).rejects.toThrow("down");
  });
});

describe("history storage", () => {
  it("keys the cache by network, executor, and account, lower-cased", () => {
    expect(historyKey(networks.testnet, "0xB36B2E012003840951CFf00fA6b1E3237A110920", ME)).toBe(
      "mezoroute.testnet.history.0xb36b2e012003840951cff00fa6b1e3237a110920.0xd74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    );
  });

  it("round-trips bigints and rejects anything that is not a cache", () => {
    const cache = { scannedTo: 950n, events: [entered(900n, 3)] };
    expect(parseHistory(serializeHistory(cache))).toEqual(cache);
    expect(parseHistory(null)).toBeNull();
    expect(parseHistory("not json")).toBeNull();
    expect(parseHistory('{"scannedTo":1,"events":[]}')).toBeNull();
  });
});
