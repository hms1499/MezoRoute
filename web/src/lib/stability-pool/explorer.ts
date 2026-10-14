import type { Address, Hex } from "viem";

/**
 * One log as Blockscout's etherscan-style `getLogs` returns it: hex strings, and `null` for unused
 * topic slots. The explorer frontend serves no API; `NetworkConfig.explorerApiUrl` is its backend.
 */
export type ExplorerLog = { blockNumber: string; logIndex: string; transactionHash: Hex; topics: (Hex | null)[]; data: Hex };

/** Blockscout returns at most this many logs per request. */
export const EXPLORER_PAGE = 1_000;
export const EXPLORER_TIMEOUT_MS = 10_000;

export class ExplorerError extends Error {
  override name = "ExplorerError";
}

export type LogQuery = { address: Address; topic0: Hex; topic1: Hex };
export type FetchJson = (url: string) => Promise<unknown>;

/** The logs of an OK response; "No logs found" is an empty history; anything else is an error. */
export function parseExplorerResponse(json: unknown): ExplorerLog[] {
  if (typeof json !== "object" || json === null) throw new ExplorerError("Malformed explorer response");
  const { message, result } = json as { message?: unknown; result?: unknown };
  if (message === "No logs found") return [];
  if (message !== "OK" || !Array.isArray(result)) throw new ExplorerError(`Explorer error: ${String(message)}`);
  return result as ExplorerLog[];
}

export function explorerLogsUrl(apiUrl: string, query: LogQuery & { fromBlock: bigint }): string {
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: query.fromBlock.toString(),
    toBlock: "latest",
    address: query.address,
    topic0: query.topic0,
    topic1: query.topic1,
    topic0_1_opr: "and",
  });
  return `${apiUrl}/api?${params.toString()}`;
}

/**
 * Every log of one event for one indexed topic1. A full page continues from its last block (that
 * block is asked for again, so logs are de-duplicated by transaction and index); a full page inside
 * one block cannot advance and throws rather than loop.
 */
export async function fetchAllLogs(fetchJson: FetchJson, apiUrl: string, query: LogQuery): Promise<ExplorerLog[]> {
  const logs = new Map<string, ExplorerLog>();
  let fromBlock = 0n;
  for (;;) {
    const page = parseExplorerResponse(await fetchJson(explorerLogsUrl(apiUrl, { ...query, fromBlock })));
    for (const log of page) logs.set(`${log.transactionHash}:${log.logIndex}`, log);
    if (page.length < EXPLORER_PAGE) return [...logs.values()];
    const last = BigInt(page[page.length - 1].blockNumber);
    if (last <= fromBlock) throw new ExplorerError("Explorer page did not advance");
    fromBlock = last;
  }
}

export const browserFetchJson: FetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(EXPLORER_TIMEOUT_MS) });
  if (!response.ok) throw new ExplorerError(`Explorer HTTP ${response.status}`);
  return response.json();
};
