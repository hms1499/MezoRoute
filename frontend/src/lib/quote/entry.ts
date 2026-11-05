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

/** Pool reserves after a swap, the state `Router._addLiquidity` sizes the deposit against. */
export type DepositPool = { reserveMusd: bigint; reserveBtc: bigint; totalSupply: bigint };

/**
 * The deposit of both entry routes: Router._addLiquidity sizes it with quoteLiquidity against the
 * post-swap reserves (the MUSD side first, the BTC side when that needs more BTC than is on hand), and
 * Pool.mint gives the smaller of the two shares. The routes differ only in the swap before it.
 */
export function depositLiquidity(
  pool: DepositPool,
  musdDesired: bigint,
  btcDesired: bigint,
): { musdAdded: bigint; btcAdded: bigint; liquidity: bigint } {
  const btcOptimal = (musdDesired * pool.reserveBtc) / pool.reserveMusd;
  const [musdAdded, btcAdded] =
    btcOptimal <= btcDesired ? [musdDesired, btcOptimal] : [(btcDesired * pool.reserveMusd) / pool.reserveBtc, btcDesired];
  const byMusd = (musdAdded * pool.totalSupply) / pool.reserveMusd;
  const byBtc = (btcAdded * pool.totalSupply) / pool.reserveBtc;
  return { musdAdded, btcAdded, liquidity: byMusd < byBtc ? byMusd : byBtc };
}

/**
 * The executor's entry, step by step with the contracts' rounding: Pool.swap takes the fee out of
 * the pool and prices the rest with getAmountOut; the deposit follows (`depositLiquidity`).
 */
export function simulateEntry(pool: PoolState, net: bigint, musdToSwap: bigint): EntrySimulation {
  const { reserveMusd, reserveBtc, totalSupply, feeBps } = pool;
  const swapIn = musdToSwap - (musdToSwap * feeBps) / BPS;
  const btcFromSwap = (swapIn * reserveBtc) / (reserveMusd + swapIn);
  const musdAfterSwap = reserveMusd + swapIn;
  const btcAfterSwap = reserveBtc - btcFromSwap;

  const musdDesired = net - musdToSwap;
  const { musdAdded, btcAdded, liquidity } = depositLiquidity(
    { reserveMusd: musdAfterSwap, reserveBtc: btcAfterSwap, totalSupply },
    musdDesired,
    btcFromSwap,
  );

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

/** What `enterFromBtc` does with `net` BTC (after MezoRoute's fee) and a given BTC swap amount. */
export type BtcEntrySimulation = {
  btcToSwap: bigint;
  musdFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidity: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
  after: PoolState;
};

export type BtcEntryQuote = BtcEntrySimulation & {
  btcIn: bigint;
  fee: bigint; // MezoRoute's execution fee, in BTC
  net: bigint; // btcIn − fee
  priceImpact: bigint; // 1e18 = 100%, against the pre-trade mid price, rounded up
};

export type BtcEntryMinimums = { minMusdFromSwap: bigint; minMusdAdded: bigint; minBtcAdded: bigint; minLpOut: bigint };

/** `enterFromBtc` step by step: BTC is swapped to MUSD (the fee leaves the pool as in `simulateEntry`), then the shared deposit. */
export function simulateEntryFromBtc(pool: PoolState, net: bigint, btcToSwap: bigint): BtcEntrySimulation {
  const { reserveMusd, reserveBtc, totalSupply, feeBps } = pool;
  const swapIn = btcToSwap - (btcToSwap * feeBps) / BPS;
  const musdFromSwap = (swapIn * reserveMusd) / (reserveBtc + swapIn);
  const btcAfterSwap = reserveBtc + swapIn;
  const musdAfterSwap = reserveMusd - musdFromSwap;

  const btcDesired = net - btcToSwap;
  const { musdAdded, btcAdded, liquidity } = depositLiquidity(
    { reserveMusd: musdAfterSwap, reserveBtc: btcAfterSwap, totalSupply },
    musdFromSwap,
    btcDesired,
  );

  return {
    btcToSwap,
    musdFromSwap,
    musdAdded,
    btcAdded,
    liquidity,
    musdRefund: musdFromSwap - musdAdded,
    btcRefund: btcDesired - btcAdded,
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

/** The same loss for a BTC → MUSD swap: 1 − musdFromSwap × R_btc / (btcToSwap × R_musd). */
function btcPriceImpact(pool: PoolState, btcToSwap: bigint, musdFromSwap: bigint): bigint {
  if (btcToSwap === 0n) return 0n;
  const atMid = btcToSwap * pool.reserveMusd;
  const received = musdFromSwap * pool.reserveBtc;
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

/**
 * The full BTC entry quote for `btcIn`; null without an amount or with an empty pool. The split is the
 * MUSD route's optimum with the roles swapped (the equation is symmetric in the swapped token's reserve).
 */
export function quoteEntryFromBtc(pool: PoolState, btcIn: bigint, executorFeeBps: bigint): BtcEntryQuote | null {
  if (btcIn <= 0n || pool.reserveMusd === 0n || pool.reserveBtc === 0n || pool.totalSupply === 0n) return null;
  const fee = (btcIn * executorFeeBps) / BPS;
  const net = btcIn - fee;
  const simulation = simulateEntryFromBtc(pool, net, optimalSwap(net, pool.reserveBtc, pool.feeBps));
  return {
    ...simulation,
    btcIn,
    fee,
    net,
    priceImpact: btcPriceImpact(pool, simulation.btcToSwap, simulation.musdFromSwap),
  };
}

/** Each expected value minus the slippage, rounded down (the four minimums of EnterFromBtcParams). */
export function btcEntryMinimums(simulation: BtcEntrySimulation, slippageBps: bigint): BtcEntryMinimums {
  const floor = (value: bigint) => (value * (BPS - slippageBps)) / BPS;
  return {
    minMusdFromSwap: floor(simulation.musdFromSwap),
    minMusdAdded: floor(simulation.musdAdded),
    minBtcAdded: floor(simulation.btcAdded),
    minLpOut: floor(simulation.liquidity),
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

/**
 * The new LP share in MUSD at the pool's price before the entry (Compare routes' "Position after", the
 * review page's LP value). The oracle sat ≈3% above the testnet pool (QA), and the post-trade price
 * includes the user's own swap, which pushed the price up; either one made a fresh deposit look like a
 * gain (review, 15 Oct 2026). The swap fills below this price, so the value never exceeds the amount.
 */
export function entryValue(pool: PoolState, quote: Pick<EntryQuote, "after" | "liquidity">): bigint {
  const { after, liquidity } = quote;
  const shareMusd = (liquidity * after.reserveMusd) / after.totalSupply;
  const shareBtc = (liquidity * after.reserveBtc) / after.totalSupply;
  return shareMusd + (shareBtc * pool.reserveMusd) / pool.reserveBtc;
}
