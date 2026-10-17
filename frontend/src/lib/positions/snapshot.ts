import { erc20Abi, zeroAddress, type Address } from "viem";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { priceFeedAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import type { ExitPool } from "@/lib/quote/exit";
import { claimableFees, type Fees } from "./fees";

/** Everything the positions pages read, from one block. */
export type PositionsSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  lpBalance: bigint;
  pool: ExitPool;
  fees: Fees; // what claimFees() would pay at this block
  allowance: bigint; // LP the executor may already pull
  permitNonce: bigint; // LP EIP-2612 nonce of the account
  blockNumber: bigint;
  blockTimestamp: bigint;
};

export type PositionsData = { snapshot: PositionsSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

export type PositionsResults = readonly [
  price: bigint,
  lpBalance: bigint,
  totalSupply: bigint,
  reserves: readonly [bigint, bigint, bigint],
  poolMusd: bigint,
  poolBtc: bigint,
  feeBps: bigint,
  index0: bigint,
  index1: bigint,
  supplyIndex0: bigint,
  supplyIndex1: bigint,
  claimable0: bigint,
  claimable1: bigint,
  allowance: bigint,
  permitNonce: bigint,
  blockNumber: bigint,
  blockTimestamp: bigint,
];

/** One multicall on the selected network. Without an executor (mainnet before M1) the allowance is read for the zero address. */
export function positionsContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  const spender = network.executor?.address ?? zeroAddress;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [a.pool] },
    { chainId, address: a.btc, abi: erc20Abi, functionName: "balanceOf", args: [a.pool] },
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "index0" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "index1" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "supplyIndex0", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "supplyIndex1", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "claimable0", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "claimable1", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "allowance", args: [account, spender] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "nonces", args: [account] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
  ] as const;
}

export function parsePositionsSnapshot(network: NetworkConfig, results: PositionsResults): PositionsSnapshot {
  const [
    price,
    lpBalance,
    totalSupply,
    reserves,
    poolMusd,
    poolBtc,
    feeBps,
    index0,
    index1,
    supplyIndex0,
    supplyIndex1,
    claimable0,
    claimable1,
    allowance,
    permitNonce,
    blockNumber,
    blockTimestamp,
  ] = results;
  const musdFirst = musdIsToken0(network);
  return {
    price,
    lpBalance,
    pool: {
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
      balanceMusd: poolMusd,
      balanceBtc: poolBtc,
      totalSupply,
      feeBps,
    },
    fees: claimableFees(network, { lpBalance, index0, index1, supplyIndex0, supplyIndex1, claimable0, claimable1 }),
    allowance,
    permitNonce,
    blockNumber,
    blockTimestamp,
  };
}
