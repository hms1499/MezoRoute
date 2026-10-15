import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { backtestRoutes, fetchRouteHistory, withTimeout, type HistoryClient } from "./history";
import {
  MAINNET_HEAD_BLOCK,
  MAINNET_HEAD_TIME,
  MAINNET_PAST_TIME,
  MAINNET_POOL_NOW,
  MAINNET_POOL_PAST,
  MAINNET_PRICE_NOW,
  MAINNET_SP_NOW,
  MAINNET_SP_PAST,
  ONE,
} from "./test-fixtures";

const network = networks.mainnet; // token0 is BTC: index0 is the BTC index
const PAST = 11_857_975n; // pastBlock() for a 3.922 s average block time

const pastState = [
  MAINNET_POOL_PAST.indexBtc,
  MAINNET_POOL_PAST.indexMusd,
  [MAINNET_POOL_PAST.reserveBtc, MAINNET_POOL_PAST.reserveMusd, 1_789_515_029n],
  MAINNET_POOL_PAST.totalSupply,
  30n,
  MAINNET_SP_PAST.P,
  0n,
  0n,
];
const headState = [
  MAINNET_POOL_NOW.indexBtc,
  MAINNET_POOL_NOW.indexMusd,
  [MAINNET_POOL_NOW.reserveBtc, MAINNET_POOL_NOW.reserveMusd, 1_792_028_034n],
  MAINNET_POOL_NOW.totalSupply,
  30n,
  MAINNET_PRICE_NOW,
  MAINNET_SP_NOW.P,
  0n,
  0n,
  MAINNET_SP_NOW.sumAtPastScale,
  0n,
];

type Call = { blockNumber: bigint; names: string[]; args: unknown[]; multicallAddress: string };

function fakeClient(options: { failPast?: boolean } = {}) {
  const calls: Call[] = [];
  const client: HistoryClient = {
    async getBlock(args) {
      if (!args) return { number: MAINNET_HEAD_BLOCK, timestamp: MAINNET_HEAD_TIME };
      if (args.blockNumber === MAINNET_HEAD_BLOCK - 600_000n) return { number: args.blockNumber, timestamp: MAINNET_HEAD_TIME - 2_353_200n };
      if (args.blockNumber === PAST) return { number: PAST, timestamp: MAINNET_PAST_TIME };
      throw new Error(`unexpected block ${args.blockNumber}`);
    },
    async multicall({ contracts, blockNumber, multicallAddress }) {
      const list = contracts as { functionName: string; args?: unknown[] }[];
      calls.push({ blockNumber, names: list.map((c) => c.functionName), args: list.map((c) => c.args), multicallAddress });
      if (blockNumber === PAST && options.failPast) throw new Error("missing trie node");
      if (blockNumber === PAST && list.length === 8) return pastState;
      if (blockNumber === PAST && list.length === 1) return [MAINNET_SP_PAST.S];
      if (blockNumber === MAINNET_HEAD_BLOCK) return headState;
      throw new Error("unexpected multicall");
    },
  };
  return { client, calls };
}

describe("fetchRouteHistory", () => {
  it("reads the pool and Stability Pool at the past block and the head, mapped by token", async () => {
    const { client } = fakeClient();
    expect(await fetchRouteHistory(client, network)).toEqual({
      pastBlock: PAST,
      pastTime: MAINNET_PAST_TIME,
      headBlock: MAINNET_HEAD_BLOCK,
      headTime: MAINNET_HEAD_TIME,
      price: MAINNET_PRICE_NOW,
      pool: { past: MAINNET_POOL_PAST, now: MAINNET_POOL_NOW },
      sp: { past: MAINNET_SP_PAST, now: MAINNET_SP_NOW },
    });
  });

  it("asks for the sums at the past epoch and scale, and the next scale, through the network's Multicall3", async () => {
    const { client, calls } = fakeClient();
    await fetchRouteHistory(client, network);
    expect(calls.map((c) => c.blockNumber)).toEqual([PAST, PAST, MAINNET_HEAD_BLOCK]);
    expect(calls[1]).toMatchObject({ names: ["epochToScaleToSum"], args: [[0n, 0n]] });
    expect(calls[2].names.slice(-2)).toEqual(["epochToScaleToSum", "epochToScaleToSum"]);
    expect(calls[2].args.slice(-2)).toEqual([[0n, 0n], [0n, 1n]]);
    for (const call of calls) expect(call.multicallAddress).toBe(network.addresses.multicall3);
  });

  it("rejects when a past read fails (no archive state), so only the 30-day rows fail", async () => {
    const { client } = fakeClient({ failPast: true });
    await expect(fetchRouteHistory(client, network)).rejects.toThrow("missing trie node");
  });
});

describe("backtestRoutes", () => {
  it("backtests both routes over the real window", async () => {
    const { client } = fakeClient();
    const history = await fetchRouteHistory(client, network);
    const result = backtestRoutes(history, 1_000n * ONE, 0n);
    expect(result.seconds).toBe(MAINNET_HEAD_TIME - MAINNET_PAST_TIME);
    expect(result.pastTime).toBe(MAINNET_PAST_TIME);
    expect(result.lp?.feeReturn).toBeGreaterThan(0n);
    expect(result.sp).toMatchObject({ depositNow: 1_000n * ONE, liquidated: false });
  });
});

describe("withTimeout", () => {
  it("rejects a promise that takes too long", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("Timed out");
  });

  it("passes a value through", async () => {
    await expect(withTimeout(Promise.resolve(7), 1_000)).resolves.toBe(7);
  });
});
