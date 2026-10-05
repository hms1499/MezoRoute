"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot } from "./snapshot";

const REFRESH_MS = 30_000;

export type DashboardData = { snapshot: DashboardSnapshot; gasBalance: bigint; gasPrice: bigint | undefined };

/**
 * The dashboard's reads: one multicall snapshot plus the BTC gas balance and gas price, all on the
 * selected network whatever chain the wallet is on, refreshed every 30 s. A gas-price failure only
 * loosens the gas check; a snapshot or balance failure is an error. F3/F5 refresh after each
 * confirmed transaction (FR-02).
 */
export function useDashboardSnapshot(account: Address): {
  data: DashboardData | undefined;
  error: Error | null;
  refresh: () => void;
} {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: snapshotContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: REFRESH_MS } });

  const data =
    reads.data && gas.data
      ? { snapshot: parseSnapshot(network, reads.data), gasBalance: gas.data.value, gasPrice: gasPrice.data }
      : undefined;
  return {
    data,
    error: reads.error ?? gas.error ?? null,
    refresh: () => {
      void reads.refetch();
      void gas.refetch();
      void gasPrice.refetch();
    },
  };
}
