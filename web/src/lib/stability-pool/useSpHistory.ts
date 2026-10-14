"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useNetwork } from "@/lib/config/network-context";
import { HistoryLagError, historyLagging, historyStatus, spCostBasis, type HistoryStatus, type SpCostBasis } from "./cost-basis";
import { browserFetchJson } from "./explorer";
import { fetchSpHistoryRows, spActions } from "./history";

const HISTORY_REFRESH_MS = 60_000;
/** A lagging explorer is asked again every 15 s, four times, before the rows say "Unavailable". */
const LAG_RETRIES = 4;
const LAG_RETRY_MS = 15_000;

/**
 * The cost basis from the explorer API (spec F5 §2). The query key carries `deposits(account)`, so a
 * confirmed action refetches; a history that does not end at that deposit is a lag, not an answer.
 */
export function useSpHistory(
  account: Address,
  initialDeposit: bigint | undefined,
): { status: HistoryStatus; basis: SpCostBasis | null; retry: () => void } {
  const { network } = useNetwork();
  const query = useQuery({
    queryKey: ["sp-history", network.chainId, account, initialDeposit?.toString()],
    enabled: initialDeposit !== undefined,
    refetchInterval: HISTORY_REFRESH_MS,
    retry: (failures, error) => error instanceof HistoryLagError && failures < LAG_RETRIES,
    retryDelay: LAG_RETRY_MS,
    queryFn: async () => {
      const basis = spCostBasis(spActions(await fetchSpHistoryRows(browserFetchJson, network, account)));
      if (initialDeposit !== undefined && historyLagging(basis, initialDeposit)) {
        throw new HistoryLagError("The explorer has not indexed the latest Stability Pool action yet");
      }
      return basis;
    },
  });
  return {
    status: historyStatus({ hasData: query.data !== undefined, error: query.error, failureReason: query.failureReason }),
    basis: query.data ?? null,
    retry: () => void query.refetch(),
  };
}
