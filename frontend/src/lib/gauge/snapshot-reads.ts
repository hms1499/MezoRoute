import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";
import { useConfig, type Config } from "wagmi";
import { hashFn, readContractsQueryOptions, structuralSharing } from "wagmi/query";
import type { NetworkConfig } from "@/lib/config/networks";
import { GAUGE_READS } from "./state";

type ReadOutcome = { status: "success"; result: unknown } | { status: "failure"; error: Error; result?: undefined };

/** The values of one snapshot multicall. A failed gauge read leaves the gauge's values out, so the parsers see no gauge. */
export type SnapshotReads = { results: readonly unknown[]; gaugeReadFailed: boolean };

/**
 * One reverting gauge read must not blank a page that works without it, so a multicall that includes the
 * gauge reads with `allowFailure: true`. Any other failed read raises its own error, exactly as
 * `allowFailure: false` did. A dead RPC reports every call as failed rather than rejecting, so it raises here too.
 */
export function unwrapSnapshotReads(
  outcomes: readonly ReadOutcome[],
  gauge: { start: number; count: number },
  tolerate: ReadonlyMap<number, unknown> = new Map(),
): SnapshotReads {
  const end = gauge.start + gauge.count;
  const isGauge = (index: number) => index >= gauge.start && index < end;
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.status === "failure" && !isGauge(index) && !tolerate.has(index)) throw outcome.error;
  }
  const gaugeReadFailed = outcomes.some((outcome, index) => outcome.status === "failure" && isGauge(index));
  const kept = outcomes
    .map((outcome, index) => ({ outcome, index }))
    .filter(({ index }) => !(gaugeReadFailed && isGauge(index)))
    // A tolerated failure keeps its slot, so the positional parsers still line up.
    .map(({ outcome, index }) => (outcome.status === "success" ? outcome.result : tolerate.get(index)));
  return { results: kept, gaugeReadFailed };
}

type SnapshotReadsInput = {
  network: NetworkConfig;
  contracts: readonly unknown[]; // one multicall on the selected network, every call carrying its chainId
  gaugeStart: number; // the index of the first of the gauge's reads
  /**
   * Reads whose failure has a meaning the caller can state (index → substitute). U13 tolerates the BTC allowance for
   * the zero address, which the BTC precompile reverts; that read then carries the substitute instead of blanking the page.
   */
  tolerate?: ReadonlyMap<number, unknown>;
};

/**
 * The query behind `useSnapshotReads`. The unwrap runs inside `queryFn` so a failure is a failed fetch: TanStack retries it,
 * keeps the last good data, and reports `error`, and `refetch()` resolves with that `error`, just as with `useReadContracts`.
 */
export function snapshotReadsQuery(config: Config, { network, contracts, gaugeStart, tolerate }: SnapshotReadsInput) {
  const options = readContractsQueryOptions(config, { contracts: contracts as never, allowFailure: true });
  const gauge = { start: gaugeStart, count: network.gauge ? GAUGE_READS : 0 };
  return {
    queryKey: options.queryKey as readonly unknown[],
    queryFn: async (context: QueryFunctionContext): Promise<SnapshotReads> =>
      unwrapSnapshotReads((await options.queryFn(context as never)) as unknown as readonly ReadOutcome[], gauge, tolerate),
    queryKeyHashFn: hashFn,
    structuralSharing,
  };
}

/** A snapshot multicall that survives a failed gauge read, refetched on the page's own interval. */
export function useSnapshotReads({ refetchInterval, ...input }: SnapshotReadsInput & { refetchInterval: number }) {
  const config = useConfig();
  return useQuery({ ...snapshotReadsQuery(config, input), refetchInterval });
}
