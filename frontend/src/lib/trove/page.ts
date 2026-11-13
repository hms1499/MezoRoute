import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import type { Band } from "@/lib/chart/move-chart";
import type { CrPlot } from "@/lib/exposure/plots";
import { mcrCrossing, MOVES } from "@/lib/exposure/moves";
import { asDashboardSnapshot } from "@/lib/leverage/dashboard-view";
import { redemptionQueue, type QueueEntry } from "@/lib/leverage/queue";
import { minOpenBtc } from "@/lib/leverage/quote-open";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { nominalCr, type TroveState } from "@/lib/leverage/trove-math";
import { WAD } from "@/lib/math";
import { DEFAULT_SLIPPAGE } from "@/lib/quote/entry";
import { GAS_COMPENSATION, LEVERAGE_CR_FLOOR, MIN_NET_DEBT } from "./constants";
import { borrowHeadroom, collateralRatio, liquidationPrice } from "./health";
import { interestDrift, liquidationDrop, liquidationRisk, multiplyView, redemptionRisk, riskLines, type LiquidationRisk, type RedemptionRisk } from "./risk";

/** U20: what `/trove/` shows, from the Trove snapshot and the redemption queue alone. */
export type TroveSummary = {
  cr: bigint | null;
  liquidationRisk: LiquidationRisk | null;
  redemption: { risk: RedemptionRisk; debtAhead: bigint; share: bigint; rank: number; total: number } | "loading" | "unreadable" | "not-applicable";
  liquidationPrice: bigint | null;
  drop: number | null; // null when there is no liquidation price, or the Trove is already at or below it
  drift: bigint | null;
  borrowable: bigint;
  multiply: ReturnType<typeof multiplyView>;
  collValue: bigint;
};

export type OpenFacts = { minDebt: bigint; rateBps: bigint; borrowingRate: bigint; minOwnBtc: bigint | null };

export type TrovePageState = { kind: "trove"; summary: TroveSummary } | { kind: "none"; open: OpenFacts; surplusBtc: bigint };

/** `queue`: the redemption queue, "loading" while it is first read, null when the read failed. */
export function trovePageState(input: { snapshot: TroveSnapshot; queue: QueueEntry[] | "loading" | null; account: Address | undefined; network: NetworkConfig }): TrovePageState {
  const { snapshot, queue, account, network } = input;
  const t = snapshot.trove;
  if (!account || !t) {
    return { kind: "none", open: openFacts(snapshot, network), surplusBtc: account ? snapshot.surplusBtc : 0n };
  }
  const { price, mcr } = snapshot.market;
  const dashboard = asDashboardSnapshot(snapshot, t);
  const trove = dashboard.trove!;
  const cr = collateralRatio(trove, price);
  const liqPrice = liquidationPrice(trove, mcr);
  return {
    kind: "trove",
    summary: {
      cr,
      liquidationRisk: liquidationRisk(cr, mcr),
      redemption: redemption(queue, account, t, cr, mcr),
      liquidationPrice: liqPrice,
      drop: liqPrice === null || liqPrice >= price ? null : liquidationDrop(liqPrice, price),
      drift: interestDrift(t, mcr),
      borrowable: borrowHeadroom(trove, price, dashboard.protocol),
      multiply: multiplyView(t, price),
      collValue: (t.coll * price) / WAD,
    },
  };
}

/**
 * Redemptions skip a Trove under the MCR; a failed queue read blanks only this. The queue is cached for a minute
 * and may predate the last action (or miss a Trove just opened), so the Trove is placed by its snapshot (NICR and
 * debt), never by its queue entry. Total: every other Trove's debt in the queue read, plus this Trove's.
 */
function redemption(queue: QueueEntry[] | "loading" | null, account: Address, t: TroveState, cr: bigint | null, mcr: bigint): TroveSummary["redemption"] {
  if (cr === null || cr < mcr) return "not-applicable";
  if (queue === "loading") return "loading";
  if (!queue) return "unreadable";
  const isOwn = (e: QueueEntry) => e.owner.toLowerCase() === account.toLowerCase();
  const total = queue.reduce((sum, e) => (isOwn(e) ? sum : sum + e.debt), t.debt);
  const position = redemptionQueue(queue, account, nominalCr(t), mcr);
  const risk = redemptionRisk(position.debtAhead, total);
  if (!risk) return "not-applicable";
  return { risk, debtAhead: position.debtAhead, share: (position.debtAhead * WAD) / total, rank: position.rank, total: position.total };
}

function openFacts(snapshot: TroveSnapshot, network: NetworkConfig): OpenFacts {
  const lev = network.leverage;
  return {
    minDebt: MIN_NET_DEBT + GAS_COMPENSATION,
    rateBps: snapshot.newTroveRateBps,
    borrowingRate: snapshot.market.borrowingRate,
    minOwnBtc: lev ? minOpenBtc(snapshot.pool, snapshot.market, LEVERAGE_CR_FLOOR, DEFAULT_SLIPPAGE, lev.feeBps, lev.maxBtcFlash) : null,
  };
}

const toPercent = (ratio: bigint) => Number(ratio) / 1e16;

/** The CR line over BTC moves, with Liquidation, High and Medium as bands (U20 §4); null without a Trove. */
export function troveCrPlot(snapshot: TroveSnapshot): CrPlot | null {
  const t = snapshot.trove;
  if (!t) return null;
  const dashboard = asDashboardSnapshot(snapshot, t);
  const { price, mcr } = snapshot.market;
  const points = MOVES.flatMap((move) => {
    const cr = collateralRatio(dashboard.trove!, (price * BigInt(100 + move)) / 100n);
    return cr === null ? [] : [{ move, value: toPercent(cr) }];
  });
  if (points.length === 0) return null;
  const lines = riskLines(mcr);
  const bands: Band[] = [
    { from: 0, to: toPercent(mcr), tone: "danger", label: "Liquidation" },
    { from: toPercent(mcr), to: toPercent(lines.high), tone: "danger", label: "High" },
    { from: toPercent(lines.high), to: toPercent(lines.medium), tone: "warning", label: "Medium" },
  ];
  return { series: { id: "cr", points }, bands, crossing: mcrCrossing(dashboard) };
}
