import { WAD } from "@/lib/math";
import type { PoolPoint } from "./lp-backtest";
import type { SpNow, SpPast } from "./sp-backtest";

// Test data only: mainnet reads with `cast` on 15 Oct 2026 at blocks 11,878,862 (past) and 12,518,862 (head).
// The pool's token0 is BTC on mainnet, so index0 is the BTC index and index1 the MUSD index.

export const ONE = WAD;

export const MAINNET_PAST_BLOCK = 11_878_862n;
export const MAINNET_HEAD_BLOCK = 12_518_862n;
export const MAINNET_PAST_TIME = 1_789_528_999n; // 16 Sep 2026 03:23:19 UTC
export const MAINNET_HEAD_TIME = 1_792_028_137n;
export const MAINNET_SECONDS = MAINNET_HEAD_TIME - MAINNET_PAST_TIME; // 2,499,138 s ≈ 28.9 days

export const MAINNET_POOL_PAST: PoolPoint = {
  reserveMusd: 190_904_600_985_487_322_454_909n,
  reserveBtc: 2_482_087_059_314_586_149n,
  totalSupply: 688_361_624_851_218_501_332n,
  feeBps: 30n,
  indexMusd: 19_546_743_927_044_764_245n,
  indexBtc: 198_933_653_530_832n,
};

export const MAINNET_POOL_NOW: PoolPoint = {
  reserveMusd: 102_550_926_417_461_780_755_855n,
  reserveBtc: 1_242_190_951_629_082_119n,
  totalSupply: 356_914_278_883_031_761_432n,
  feeBps: 30n,
  indexMusd: 19_911_507_212_486_742_590n,
  indexBtc: 202_966_274_473_322n,
};

export const MAINNET_PRICE_NOW = 81_669_799_990_000_000_000_000n;

const MAINNET_P = 945_105_103_840_338_372n;
const MAINNET_S = 819_121_711_620_961_369_568_223_825_678n;

/** No liquidation reached the mainnet Stability Pool between the two blocks. */
export const MAINNET_SP_PAST: SpPast = { P: MAINNET_P, S: MAINNET_S, epoch: 0n, scale: 0n };
export const MAINNET_SP_NOW: SpNow = { P: MAINNET_P, epoch: 0n, scale: 0n, sumAtPastScale: MAINNET_S, sumAtNextScale: 0n };
