import { erc20Abi } from "viem";
import { priceFeedAbi, stabilityPoolAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";

/** Mainnet today, for the testnet reference card (spec F8 §1). */
export type MainnetReference = {
  reserveMusd: bigint;
  reserveBtc: bigint;
  lpSupply: bigint;
  feeBps: bigint;
  price: bigint; // oracle, MUSD per BTC
  musdSupply: bigint;
  spDeposits: bigint;
};

export type ReferenceResults = readonly [
  reserves: readonly [bigint, bigint, bigint],
  lpSupply: bigint,
  feeBps: bigint,
  price: bigint,
  musdSupply: bigint,
  spDeposits: bigint,
];

/** One multicall at the head; no chainId, because the card's own mainnet client sends it. */
export function referenceContracts(network: NetworkConfig) {
  const a = network.addresses;
  return [
    { address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { address: a.musd, abi: erc20Abi, functionName: "totalSupply" },
    { address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" },
  ] as const;
}

export function parseReference(network: NetworkConfig, results: ReferenceResults): MainnetReference {
  const [reserves, lpSupply, feeBps, price, musdSupply, spDeposits] = results;
  const musdFirst = musdIsToken0(network);
  return {
    reserveMusd: musdFirst ? reserves[0] : reserves[1],
    reserveBtc: musdFirst ? reserves[1] : reserves[0],
    lpSupply,
    feeBps,
    price,
    musdSupply,
    spDeposits,
  };
}

/** Pool value in MUSD at the oracle price, and the Stability Pool's share of MUSD supply (1e18 = 100%). */
export function referenceView(reference: MainnetReference): { poolTvl: bigint; spShare: bigint } {
  return {
    poolTvl: reference.reserveMusd + (reference.reserveBtc * reference.price) / WAD,
    spShare: reference.musdSupply === 0n ? 0n : (reference.spDeposits * WAD) / reference.musdSupply,
  };
}
