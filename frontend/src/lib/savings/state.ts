import { gaugeAbi } from "@/lib/abi/gauge";
import { voterAbi } from "@/lib/abi/pool";
import { savingsVaultAbi } from "@/lib/abi/savings";
import type { NetworkConfig } from "@/lib/config/networks";

// U19 §4: the Savings Vault (sMUSD) and its MEZO gauge, compared read-only. Staked sMUSD belongs to the gauge, so its
// MUSD yield goes to the gauge (capped by `gaugeYieldClaimCap`), not to the staker: staking earns MEZO only.

export type SavingsGauge = { alive: boolean; rewardRate: bigint; periodFinish: bigint; totalStaked: bigint };
export type SavingsState = { totalSupply: bigint; yieldIndex: bigint; gauge: SavingsGauge | null };

/** The vault's two reads, then (where it has a gauge) the voter's isAlive and the gauge's three; [] without a vault. */
export function savingsContracts(network: NetworkConfig) {
  const vault = network.savingsVault;
  // `never` keeps the tuple type below, as `gaugeContracts` does.
  if (!vault) return [] as never;
  const { chainId } = network;
  const reads = [
    { chainId, address: vault.address, abi: savingsVaultAbi, functionName: "totalSupply" },
    { chainId, address: vault.address, abi: savingsVaultAbi, functionName: "yieldIndex" },
  ] as const;
  if (!vault.gauge || !network.gauge) return reads;
  return [
    ...reads,
    { chainId, address: network.gauge.voter, abi: voterAbi, functionName: "isAlive", args: [vault.gauge] },
    { chainId, address: vault.gauge, abi: gaugeAbi, functionName: "rewardRate" },
    { chainId, address: vault.gauge, abi: gaugeAbi, functionName: "periodFinish" },
    { chainId, address: vault.gauge, abi: gaugeAbi, functionName: "totalSupply" },
  ] as const;
}

export function parseSavingsState(network: NetworkConfig, results: readonly unknown[]): SavingsState {
  const [totalSupply, yieldIndex, alive, rewardRate, periodFinish, totalStaked] = results as [bigint, bigint, boolean?, bigint?, bigint?, bigint?];
  const hasGauge = network.savingsVault?.gauge && results.length === 6;
  return {
    totalSupply,
    yieldIndex,
    gauge: hasGauge ? { alive: alive!, rewardRate: rewardRate!, periodFinish: periodFinish!, totalStaked: totalStaked! } : null,
  };
}
