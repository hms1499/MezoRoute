import { describe, expect, it, vi } from "vitest";
import { EXPLORER_PAGE, ExplorerError, explorerLogsUrl, fetchAllLogs, parseExplorerResponse, type ExplorerLog } from "./explorer";
import depositChanged from "./fixtures/e3b0-deposit-changed.json";

const SP = "0x1CCA7E410eE41739792eA0A24e00349Dd247680e";
const QUERY = {
  address: SP,
  topic0: "0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9",
  topic1: "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826",
} as const;

function log(block: number, index: number): ExplorerLog {
  return {
    blockNumber: `0x${block.toString(16)}`,
    logIndex: `0x${index.toString(16)}`,
    transactionHash: `0x${block.toString(16).padStart(32, "0")}${index.toString(16).padStart(32, "0")}`,
    topics: [QUERY.topic0, QUERY.topic1, null, null],
    data: "0x",
  };
}

describe("parseExplorerResponse", () => {
  it("returns the logs of an OK response", () => {
    expect(parseExplorerResponse(depositChanged)).toHaveLength(7);
  });

  it("treats Blockscout's 'No logs found' as an empty history", () => {
    expect(parseExplorerResponse({ message: "No logs found", result: [], status: "0" })).toEqual([]);
  });

  it.each([[{ message: "Invalid fromBlock format", result: null, status: "0" }], [null], ["<html>"]])("rejects %j", (json) => {
    expect(() => parseExplorerResponse(json)).toThrow(ExplorerError);
  });
});

describe("explorerLogsUrl", () => {
  it("asks for one event of one depositor from a block", () => {
    const url = new URL(explorerLogsUrl("https://api.explorer.test.mezo.org", { ...QUERY, fromBlock: 15_000_000n }));
    expect(url.origin + url.pathname).toBe("https://api.explorer.test.mezo.org/api");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      module: "logs",
      action: "getLogs",
      fromBlock: "15000000",
      toBlock: "latest",
      address: SP,
      topic0: QUERY.topic0,
      topic1: QUERY.topic1,
      topic0_1_opr: "and",
    });
  });
});

describe("fetchAllLogs", () => {
  it("makes one request when the page is not full", async () => {
    const fetchJson = vi.fn().mockResolvedValue(depositChanged);
    expect(await fetchAllLogs(fetchJson, "https://x", QUERY)).toHaveLength(7);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("pages from the last block of a full page and drops duplicates", async () => {
    const first = Array.from({ length: EXPLORER_PAGE }, (_, i) => log(100 + Math.floor(i / 2), i % 2));
    const lastBlock = 100 + Math.floor((EXPLORER_PAGE - 1) / 2);
    const second = [log(lastBlock, 1), log(lastBlock + 1, 0)];
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({ message: "OK", result: first, status: "1" })
      .mockResolvedValueOnce({ message: "OK", result: second, status: "1" });
    const logs = await fetchAllLogs(fetchJson, "https://x", QUERY);
    expect(logs).toHaveLength(EXPLORER_PAGE + 1);
    expect(new URL(fetchJson.mock.calls[1][0]).searchParams.get("fromBlock")).toBe(lastBlock.toString());
  });

  it("throws instead of looping when one block holds a full page", async () => {
    const full = Array.from({ length: EXPLORER_PAGE }, (_, i) => log(0, i));
    const fetchJson = vi.fn().mockResolvedValue({ message: "OK", result: full, status: "1" });
    await expect(fetchAllLogs(fetchJson, "https://x", QUERY)).rejects.toThrow(ExplorerError);
  });
});
