import { ceilDiv, isqrt, WAD } from "@/lib/math";

const BPS = 10_000n;

/** The MUSD/BTC pool as the quote sees it: reserves by token (not token0/token1), LP supply, swap fee in bps. */
export type PoolState = { reserveMusd: bigint; reserveBtc: bigint; totalSupply: bigint; feeBps: bigint };

/** What `enter` does with `net` MUSD (after MezoRoute's fee) and a given swap amount. */
export type EntrySimulation = {
  musdToSwap: bigint;
  btcFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidity: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
  after: PoolState; // the pool after the swap and the deposit
};

export type EntryQuote = EntrySimulation & {
  musdIn: bigint;
  fee: bigint; // MezoRoute's execution fee
  net: bigint; // musdIn − fee
  priceImpact: bigint; // 1e18 = 100%, against the pre-trade mid price, rounded up
};

export type EntryMinimums = { minBtcFromSwap: bigint; minMusdAdded: bigint; minBtcAdded: bigint; minLpOut: bigint };

/** Slippage presets in bps (PRODUCT_SPEC §12); never raised silently. */
export const SLIPPAGE_PRESETS = [50n, 100n, 200n] as const;
export type SlippageBps = (typeof SLIPPAGE_PRESETS)[number];
export const DEFAULT_SLIPPAGE: SlippageBps = 100n;

/**
 * MUSD to swap so that the BTC received and the MUSD kept match the post-swap reserve ratio. Tigris
 * moves the swap fee out of the pool (Pool._update0), so with g = 1 − f the condition is
 * g²s² + r(2 − f)s − a·r = 0 (PRODUCT_SPEC §12), solved here in bps-scaled integers.
 */
export function optimalSwap(net: bigint, reserveMusd: bigint, feeBps: bigint): bigint {
  if (net <= 0n || reserveMusd <= 0n) return 0n;
  const g = BPS - feeBps;
  const b = reserveMusd * (2n * BPS - feeBps);
  return ((isqrt(b * b + 4n * g * g * net * reserveMusd) - b) * BPS) / (2n * g * g);
}

/**
 * The executor's entry, step by step with the contracts' rounding: Pool.swap takes the fee out of
 * the pool and prices the rest with getAmountOut; Router._addLiquidity sizes the deposit with
 * quoteLiquidity against the post-swap reserves; Pool.mint gives the smaller of the two shares.
 */
export function simulateEntry(pool: PoolState, net: bigint, musdToSwap: bigint): EntrySimulation {
  const { reserveMusd, reserveBtc, totalSupply, feeBps } = pool;
  const swapIn = musdToSwap - (musdToSwap * feeBps) / BPS;
  const btcFromSwap = (swapIn * reserveBtc) / (reserveMusd + swapIn);
  const musdAfterSwap = reserveMusd + swapIn;
  const btcAfterSwap = reserveBtc - btcFromSwap;

  const musdDesired = net - musdToSwap;
  const btcOptimal = (musdDesired * btcAfterSwap) / musdAfterSwap;
  const [musdAdded, btcAdded] =
    btcOptimal <= btcFromSwap
      ? [musdDesired, btcOptimal]
      : [(btcFromSwap * musdAfterSwap) / btcAfterSwap, btcFromSwap];
  const byMusd = (musdAdded * totalSupply) / musdAfterSwap;
  const byBtc = (btcAdded * totalSupply) / btcAfterSwap;
  const liquidity = byMusd < byBtc ? byMusd : byBtc;

  return {
    musdToSwap,
    btcFromSwap,
    musdAdded,
    btcAdded,
    liquidity,
    musdRefund: musdDesired - musdAdded,
    btcRefund: btcFromSwap - btcAdded,
    after: {
      reserveMusd: musdAfterSwap + musdAdded,
      reserveBtc: btcAfterSwap + btcAdded,
      totalSupply: totalSupply + liquidity,
      feeBps,
    },
  };
}

/** 1 − btcFromSwap × r / (s × R): the loss against the pre-trade mid price, including the pool fee. */
export function priceImpact(pool: PoolState, musdToSwap: bigint, btcFromSwap: bigint): bigint {
  if (musdToSwap === 0n) return 0n;
  const atMid = musdToSwap * pool.reserveBtc;
  const received = btcFromSwap * pool.reserveMusd;
  return ceilDiv((atMid - received) * WAD, atMid);
}

/** The full entry quote for `musdIn`; null without an amount or with an empty pool. */
export function quoteEntry(pool: PoolState, musdIn: bigint, executorFeeBps: bigint): EntryQuote | null {
  if (musdIn <= 0n || pool.reserveMusd === 0n || pool.reserveBtc === 0n || pool.totalSupply === 0n) return null;
  // The executor charges its fee before splitting the input (spec 11.3 step 5).
  const fee = (musdIn * executorFeeBps) / BPS;
  const net = musdIn - fee;
  const simulation = simulateEntry(pool, net, optimalSwap(net, pool.reserveMusd, pool.feeBps));
  return {
    ...simulation,
    musdIn,
    fee,
    net,
    priceImpact: priceImpact(pool, simulation.musdToSwap, simulation.btcFromSwap),
  };
}

/** Each expected value minus the slippage, rounded down (the four minimums of EnterParams). */
export function entryMinimums(simulation: EntrySimulation, slippageBps: bigint): EntryMinimums {
  const floor = (value: bigint) => (value * (BPS - slippageBps)) / BPS;
  return {
    minBtcFromSwap: floor(simulation.btcFromSwap),
    minMusdAdded: floor(simulation.musdAdded),
    minBtcAdded: floor(simulation.btcAdded),
    minLpOut: floor(simulation.liquidity),
  };
}
