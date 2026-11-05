import type { Address } from "viem";
import { gaugeAbi } from "@/lib/abi/gauge";
import { voterAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";

/** What the gauge says at one block, for one account. */
export type GaugeState = {
  alive: boolean;
  rewardRate: bigint; // MEZO per second, 1e18
  periodFinish: bigint; // unix seconds
  totalStaked: bigint; // LP in the gauge
  staked: bigint; // the account's LP in the gauge
  earned: bigint; // the account's pending MEZO
};

export const GAUGE_READS = 6;

export type GaugeResults = readonly [alive: boolean, rewardRate: bigint, periodFinish: bigint, totalStaked: bigint, staked: bigint, earned: bigint];

/** The six gauge reads to append to a snapshot multicall; `[]` when the network has no gauge. */
export function gaugeContracts(network: NetworkConfig, account: Address) {
  const { gauge } = network;
  if (!gauge) return [];
  const { chainId } = network;
  return [
    { chainId, address: gauge.voter, abi: voterAbi, functionName: "isAlive", args: [gauge.address] },
    { chainId, address: gauge.address, abi: gaugeAbi, functionName: "rewardRate" },
    { chainId, address: gauge.address, abi: gaugeAbi, functionName: "periodFinish" },
    { chainId, address: gauge.address, abi: gaugeAbi, functionName: "totalSupply" },
    { chainId, address: gauge.address, abi: gaugeAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: gauge.address, abi: gaugeAbi, functionName: "earned", args: [account] },
  ] as const;
}

export function parseGaugeState(results: GaugeResults): GaugeState {
  const [alive, rewardRate, periodFinish, totalStaked, staked, earned] = results;
  return { alive, rewardRate, periodFinish, totalStaked, staked, earned };
}
