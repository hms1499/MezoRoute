import { erc20Abi, type Address } from "viem";
import {
  borrowerOperationsAbi,
  borrowerOperationsSignaturesAbi,
  collSurplusPoolAbi,
  interestRateManagerAbi,
  musdPermitAbi,
  priceFeedAbi,
  troveManagerAbi,
  troveSystemAbi,
} from "@/lib/abi/musd";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { isRecoveryMode, type SystemState } from "@/lib/trove/borrow";
import type { Market, PoolState, TroveState } from "./trove-math";

export type TroveSnapshot = {
  trove: TroveState | null; // null unless the Trove is active
  troveStatus: number;
  pool: PoolState;
  market: Market;
  system: SystemState;
  recoveryMode: boolean;
  bosNonce: bigint;
  musdPermitNonce: bigint;
  btcPermitNonce: bigint;
  walletMusd: bigint;
  walletBtc: bigint;
  surplusBtc: bigint; // CollSurplusPool: BTC to claim after a redemption closed the Trove
  block: { number: bigint; timestamp: bigint };
  newTroveRateBps: bigint; // InterestRateManager.interestRate: what a Trove opened now would pay (U20)
};

export type TroveSnapshotResults = readonly [
  price: bigint,
  mcr: bigint,
  borrowingRate: bigint,
  troveStatus: number,
  debtAndColl: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
  maxBorrowingCapacity: bigint,
  interestRateBps: number,
  reserves: readonly [bigint, bigint, bigint],
  poolFeeBps: bigint,
  systemColl: bigint,
  systemDebt: bigint,
  ccr: bigint,
  troveCount: bigint,
  bosNonce: bigint,
  musdPermitNonce: bigint,
  btcPermitNonce: bigint,
  walletMusd: bigint,
  walletBtc: bigint,
  surplusBtc: bigint,
  blockNumber: bigint,
  timestamp: bigint,
  newTroveRateBps: number,
];

const TROVE_ACTIVE = 1;

/** Every Trove-page read in one multicall, so the quote, the gate and the nonces come from one block. */
export function troveSnapshotContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  const tm = { chainId, address: a.troveManager } as const;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { ...tm, abi: troveManagerAbi, functionName: "MCR" },
    { chainId, address: a.borrowerOperations, abi: borrowerOperationsAbi, functionName: "borrowingRate" },
    { ...tm, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] },
    { ...tm, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [account] },
    { ...tm, abi: troveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [account] },
    { ...tm, abi: troveManagerAbi, functionName: "getTroveInterestRate", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { ...tm, abi: troveSystemAbi, functionName: "getEntireSystemColl" },
    { ...tm, abi: troveSystemAbi, functionName: "getEntireSystemDebt" },
    { ...tm, abi: troveSystemAbi, functionName: "CCR" },
    { ...tm, abi: troveSystemAbi, functionName: "getTroveOwnersCount" },
    { chainId, address: a.borrowerOperationsSignatures, abi: borrowerOperationsSignaturesAbi, functionName: "getNonce", args: [account] },
    { chainId, address: a.musd, abi: musdPermitAbi, functionName: "nonces", args: [account] },
    { chainId, address: a.btc, abi: musdPermitAbi, functionName: "nonces", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.btc, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.collSurplusPool, abi: collSurplusPoolAbi, functionName: "getCollateral", args: [account] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
    // Last, so the indexes above never move.
    { chainId, address: a.interestRateManager, abi: interestRateManagerAbi, functionName: "interestRate" },
  ] as const;
}

export function parseTroveSnapshot(network: NetworkConfig, r: TroveSnapshotResults): TroveSnapshot {
  const [price, mcr, borrowingRate, status, debtAndColl, capacity, rate, reserves, feeBps, systemColl, systemDebt, ccr, troveCount] = r;
  // getEntireDebtAndColl's first three values already include pending redistribution; the last three
  // repeat the pending part and must not be added again.
  const [coll, principal, interest] = debtAndColl;
  const musdFirst = musdIsToken0(network);
  const system: SystemState = { coll: systemColl, debt: systemDebt, ccr, troveCount };
  return {
    trove:
      status === TROVE_ACTIVE
        ? { coll, principal, interest, debt: principal + interest, maxBorrowingCapacity: capacity, interestRateBps: BigInt(rate) }
        : null,
    troveStatus: status,
    pool: {
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
      feeBps,
    },
    market: { price, borrowingRate, mcr },
    system,
    recoveryMode: isRecoveryMode(system, price),
    bosNonce: r[13],
    musdPermitNonce: r[14],
    btcPermitNonce: r[15],
    walletMusd: r[16],
    walletBtc: r[17],
    surplusBtc: r[18],
    block: { number: r[19], timestamp: r[20] },
    newTroveRateBps: BigInt(r[21]),
  };
}
