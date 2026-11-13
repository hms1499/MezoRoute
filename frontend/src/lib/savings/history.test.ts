import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { fetchSavingsIndexes } from "./history";

describe("fetchSavingsIndexes", () => {
  it("reads the vault's yieldIndex at exactly the past and head blocks", async () => {
    const asked: (bigint | undefined)[] = [];
    const client = {
      getBlock: async () => ({ number: 0n, timestamp: 0n }),
      multicall: async (args: { blockNumber?: bigint }) => {
        asked.push(args.blockNumber);
        return [args.blockNumber === 12_485_069n ? 214_330_524_003_397_543n : 218_681_915_228_140_081n];
      },
    };
    expect(await fetchSavingsIndexes(client, networks.mainnet, 12_485_069n, 13_190_069n)).toEqual({
      past: 214_330_524_003_397_543n,
      now: 218_681_915_228_140_081n,
    });
    expect(asked.sort()).toEqual([12_485_069n, 13_190_069n]);
  });
});
