import { describe, expect, it, vi } from "vitest";
import { networks } from "@/lib/config/networks";
import fixtures from "./fixtures.json";
import { loadProofRows } from "./load";

const ok = (result: unknown[]) => ({ message: result.length ? "OK" : "No logs found", result });

describe("loadProofRows", () => {
  it("asks each contract from its deploy block and merges the rows newest first", async () => {
    const urls: string[] = [];
    const fetchJson = vi.fn(async (url: string) => {
      urls.push(url);
      const address = new URL(url).searchParams.get("address")!.toLowerCase();
      if (address === networks.mainnet.executor!.address.toLowerCase()) return ok(fixtures.mainnetV2);
      if (address === networks.mainnet.legacyExecutors[0].address.toLowerCase()) return ok(fixtures.mainnetV1);
      return ok([]);
    });
    const rows = await loadProofRows(networks.mainnet, fetchJson);
    expect(urls).toHaveLength(3);
    expect(urls.map((url) => new URL(url).searchParams.get("fromBlock")).sort()).toEqual(["12524142", "13031359", "13064669"]);
    expect(rows.map((row) => row.contract)).toEqual(["Executor V2", "Executor V2", "Executor V2", "Executor V2", "Executor V1"]);
    expect(rows[0].block >= rows[rows.length - 1].block).toBe(true);
  });

  it("fails instead of showing a shorter list when one contract's logs fail", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (new URL(url).searchParams.get("address") === networks.mainnet.leverage!.address) throw new Error("Explorer HTTP 502");
      return ok([]);
    });
    await expect(loadProofRows(networks.mainnet, fetchJson)).rejects.toThrow("502");
  });
});
