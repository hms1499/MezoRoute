import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";

/** Mezo's public RPC serves eth_getLogs over at most 10,000 blocks. */
export const LOG_RANGE = 10_000n;
/** Events this close to the head are re-read every time, so a re-org cannot leave them in the cache. */
export const REORG_MARGIN = 50n;
export const SCAN_CONCURRENCY = 6;
const ATTEMPTS = 3;

export type BlockRange = { fromBlock: bigint; toBlock: bigint };
export type HistoryEvent =
  | { kind: "entered"; blockNumber: bigint; logIndex: number; event: EnteredEvent }
  | { kind: "exited"; blockNumber: bigint; logIndex: number; event: ExitedEvent };
/** Every event up to `scannedTo`; the scan resumes after it. */
export type HistoryCache = { scannedTo: bigint; events: HistoryEvent[] };
export type ReadChunk = (range: BlockRange) => Promise<HistoryEvent[]>;

/** Ranges of `size` blocks from `from` to `head`; the last ends at the head, never past it. */
export function scanRanges(from: bigint, head: bigint, size: bigint = LOG_RANGE): BlockRange[] {
  const ranges: BlockRange[] = [];
  for (let start = from; start <= head; start += size) {
    const end = start + size - 1n;
    ranges.push({ fromBlock: start, toBlock: end < head ? end : head });
  }
  return ranges;
}

function sortEvents(events: HistoryEvent[]): HistoryEvent[] {
  return [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );
}

async function withAttempts<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
    }
  }
}

/** Reads every range, `concurrency` at a time, each with three attempts; one failed range fails the whole read. */
export async function readRanges(
  read: ReadChunk,
  ranges: BlockRange[],
  concurrency: number = SCAN_CONCURRENCY,
): Promise<HistoryEvent[]> {
  const results: HistoryEvent[][] = [];
  let next = 0;
  async function worker() {
    while (next < ranges.length) {
      const index = next;
      next += 1;
      results[index] = await withAttempts(() => read(ranges[index]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ranges.length) }, worker));
  return sortEvents(results.flat());
}

function scanStart(cache: HistoryCache | null, deployBlock: bigint): bigint {
  return cache ? cache.scannedTo + 1n : deployBlock;
}

/** All events (cached + fresh), and the next cache: only events at least REORG_MARGIN blocks deep. */
export function mergeHistory(
  cache: HistoryCache | null,
  fresh: HistoryEvent[],
  head: bigint,
  deployBlock: bigint,
): { events: HistoryEvent[]; cache: HistoryCache | null } {
  const events = sortEvents([...(cache?.events ?? []), ...fresh]);
  const safeTo = head - REORG_MARGIN;
  if (safeTo < scanStart(cache, deployBlock)) return { events, cache };
  return { events, cache: { scannedTo: safeTo, events: events.filter((item) => item.blockNumber <= safeTo) } };
}

/** Reads what the cache does not cover, up to the head. Rejects (and so caches nothing) if a range fails. */
export async function loadHistory(input: {
  read: ReadChunk;
  head: bigint;
  deployBlock: bigint;
  cache: HistoryCache | null;
}): Promise<{ events: HistoryEvent[]; cache: HistoryCache | null }> {
  const from = scanStart(input.cache, input.deployBlock);
  const fresh = from > input.head ? [] : await readRanges(input.read, scanRanges(from, input.head));
  return mergeHistory(input.cache, fresh, input.head, input.deployBlock);
}

/** One cache per network, executor, and account (spec §12: a convenience only). */
export function historyKey(network: NetworkConfig, executor: Address, account: Address): string {
  return `mezoroute.${network.id}.history.${executor.toLowerCase()}.${account.toLowerCase()}`;
}

export function serializeHistory(cache: HistoryCache): string {
  return JSON.stringify(cache, (_key, value: unknown) => (typeof value === "bigint" ? { $bigint: value.toString() } : value));
}

/** The stored cache, or null when absent or not a cache (any parse problem means a fresh scan). */
export function parseHistory(text: string | null): HistoryCache | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text, (_key, value: unknown) =>
      value !== null && typeof value === "object" && typeof (value as { $bigint?: unknown }).$bigint === "string"
        ? BigInt((value as { $bigint: string }).$bigint)
        : value,
    );
    const cache = parsed as Partial<HistoryCache> | null;
    return cache && typeof cache.scannedTo === "bigint" && Array.isArray(cache.events) ? (cache as HistoryCache) : null;
  } catch {
    return null;
  }
}
