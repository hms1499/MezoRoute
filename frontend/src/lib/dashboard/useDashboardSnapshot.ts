"use client";

import { zeroAddress, type Address } from "viem";
import { useBalance, useGasPrice } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { useSnapshotReads } from "@/lib/gauge/snapshot-reads";
import { DASHBOARD_GAUGE_START, dashboardContracts, parseDashboard, type DashboardSnapshot } from "./snapshot";

const REFRESH_MS = 30_000;

export type DashboardData = { snapshot: DashboardSnapshot; gasBalance: bigint; gasPrice: bigint | undefined };

/**
 * The dashboard's reads: one multicall snapshot plus the BTC gas balance and gas price, all on the
 * selected network whatever chain the wallet is on, refreshed every 30 s. A gas-price failure only
 * loosens the gas check; a snapshot or balance failure is an error, except a failed gauge read, which only
 * sets `gaugeReadFailed`. F3/F5 refresh after each
 * confirmed transaction (FR-02).
 *
 * U17: with no account (`/compare/` before a wallet connects) the account-scoped calls use the zero address, which
 * the chain answers with zeroes (as `useLpRouteSnapshot` does); the gas-balance query is disabled and reports `0n`.
 */
export function useDashboardSnapshot(account: Address | undefined): {
  data: DashboardData | undefined;
  error: Error | null;
  refresh: () => void;
} {
  const { network } = useNetwork();
  const connected = account !== undefined;
  const reads = useSnapshotReads({
    network,
    contracts: dashboardContracts(network, account ?? zeroAddress),
    gaugeStart: DASHBOARD_GAUGE_START,
    refetchInterval: REFRESH_MS,
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { enabled: connected, refetchInterval: REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: REFRESH_MS } });

  const data =
    reads.data && (gas.data || !connected)
      ? { snapshot: parseDashboard(network, reads.data.results, reads.data.gaugeReadFailed), gasBalance: gas.data?.value ?? 0n, gasPrice: gasPrice.data }
      : undefined;
  return {
    data,
    error: reads.error ?? (connected ? gas.error : null) ?? null,
    refresh: () => {
      void reads.refetch();
      void gas.refetch();
      void gasPrice.refetch();
    },
  };
}
