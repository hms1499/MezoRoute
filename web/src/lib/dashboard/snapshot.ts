import { erc20Abi, type Address } from "viem";
import { borrowerOperationsAbi, priceFeedAbi, stabilityPoolAbi, troveManagerAbi } from "@/lib/abi/musd";
import { poolAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";

export type Trove = {
  collateral: bigint; // BTC, 1e18, including pending redistribution
  principal: bigint; // MUSD, including pending
  interest: bigint; // MUSD accrued to now, including pending
  debt: bigint; // principal + interest
  maxBorrowingCapacity: bigint; // MUSD; BorrowerOperations rejects borrows past it
};
export type LpPosition = { balance: bigint; totalSupply: bigint; reserveMusd: bigint; reserveBtc: bigint };
export type SpPosition = { deposit: bigint; btcGain: bigint };
export type Protocol = { mcr: bigint; borrowingRate: bigint };
export type DashboardSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  protocol: Protocol;
  trove: Trove | null; // null unless the Trove is active
  musd: bigint;
  lp: LpPosition;
  sp: SpPosition;
};

/** The multicall results in `snapshotContracts` order (`allowFailure: false`). */
export type SnapshotResults = readonly [
  price: bigint,
  mcr: bigint,
  borrowingRate: bigint,
  troveStatus: number,
  debtAndColl: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
  maxBorrowingCapacity: bigint,
  musd: bigint,
  lpBalance: bigint,
  lpTotalSupply: bigint,
  reserves: readonly [bigint, bigint, bigint],
  spDeposit: bigint,
  spBtcGain: bigint,
];

/** TroveManager `Status.active`; none, closedByOwner, closedByLiquidation, and closedByRedemption mean no open Trove. */
const TROVE_ACTIVE = 1;

/**
 * Every dashboard read, sent as one multicall so all values come from the same block. Each call
 * carries the selected network's chain, so a wallet on another chain still reads this network.
 */
export function snapshotContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "MCR" },
    { chainId, address: a.borrowerOperations, abi: borrowerOperationsAbi, functionName: "borrowingRate" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getCompoundedMUSDDeposit", args: [account] },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getDepositorCollateralGain", args: [account] },
  ] as const;
}

export function parseSnapshot(network: NetworkConfig, results: SnapshotResults): DashboardSnapshot {
  const [price, mcr, borrowingRate, status, debtAndColl, maxBorrowingCapacity, musd, lpBalance, lpTotalSupply, reserves, spDeposit, spBtcGain] =
    results;
  const [collateral, principal, interest] = debtAndColl;
  // Tigris sorts a pair by address: testnet's token0 is MUSD, mainnet's is BTC.
  const musdIsToken0 = BigInt(network.addresses.musd) < BigInt(network.addresses.btc);
  return {
    price,
    protocol: { mcr, borrowingRate },
    trove:
      status === TROVE_ACTIVE
        ? { collateral, principal, interest, debt: principal + interest, maxBorrowingCapacity }
        : null,
    musd,
    lp: {
      balance: lpBalance,
      totalSupply: lpTotalSupply,
      reserveMusd: musdIsToken0 ? reserves[0] : reserves[1],
      reserveBtc: musdIsToken0 ? reserves[1] : reserves[0],
    },
    sp: { deposit: spDeposit, btcGain: spBtcGain },
  };
}
