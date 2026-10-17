import type { RouteHistory } from "@/lib/compare/history";

export const ONE = 10n ** 18n;

/** Mainnet-like pool: 101,720 MUSD + 1.25 BTC, oracle at 80,000. */
export const reference = {
  reserveMusd: 101_720n * ONE,
  reserveBtc: 1_250_000_000_000_000_000n,
  lpSupply: 356n * ONE,
  feeBps: 30n,
  price: 80_000n * ONE,
  musdSupply: 29_871_966n * ONE,
  spDeposits: 14_172_031n * ONE,
};
const pool = { reserveMusd: reference.reserveMusd, reserveBtc: reference.reserveBtc, totalSupply: reference.lpSupply, feeBps: 30n };

/** A 30-day window in which the pool's fee index grew and no liquidation reached the Stability Pool. */
export const history: RouteHistory = {
  pastBlock: 100n,
  pastTime: 1_000n,
  headBlock: 200n,
  headTime: 1_000n + 2_592_000n,
  price: 80_000n * ONE,
  pool: { past: { ...pool, indexMusd: 0n, indexBtc: 0n }, now: { ...pool, indexMusd: 10n ** 15n, indexBtc: 0n } },
  sp: {
    past: { P: ONE, S: 0n, epoch: 0n, scale: 0n },
    now: { P: ONE, epoch: 0n, scale: 0n, sumAtPastScale: 0n, sumAtNextScale: 0n },
  },
};
