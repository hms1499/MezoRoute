import type { ReactNode } from "react";
import { btc, musd } from "@/components/lp/units";
import { STRESS_DROP, type ComparedRoutes } from "@/lib/compare/comparison";
import { formatBps, formatPercent, formatToken } from "@/lib/format";

export type Row = { label: string; title?: string; value: ReactNode; sub?: string; subTone?: "positive" | "negative" | null };

/** U11 §5.5: a signed sub-line (the 30-day result) in positive or negative; every other sub-line muted. */
export function subToneClass(tone: Row["subTone"]): string {
  return tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-muted";
}

export function lpFee(executorFeeBps: bigint | null, compared: ComparedRoutes | null): string {
  if (executorFeeBps === null) return "Set at launch";
  if (compared?.lp.status === "ok") return `${formatBps(executorFeeBps)} (${musd(compared.lp.fee)})`;
  return formatBps(executorFeeBps);
}

/** Rows that need an amount; none until one is entered. */
/** `connected: false` (U17, /compare/ without a wallet): the exposure is what the deposit adds, never "0 BTC → …" for a visitor whose exposure is unknown. */
export function lpAmountRows(compared: ComparedRoutes | null, connected = true): Row[] {
  if (compared === null) return [];
  const dropLabel = `If BTC drops ${STRESS_DROP}%`;
  const { lp } = compared;
  if (lp.status === "unavailable") {
    return [
      { label: "Position after", value: "Pool quote unavailable" },
      { label: "BTC exposure", value: "Pool quote unavailable" },
      { label: dropLabel, value: "Pool quote unavailable" },
    ];
  }
  return [
    {
      label: "Position after",
      value: `≈ ${musd(lp.positionValue)}`,
      sub: `≈ half becomes BTC · price impact ${formatPercent(lp.priceImpact, 2)}`,
    },
    { label: "BTC exposure", value: connected ? `${btc(lp.btcBefore)} → ${btc(lp.btcAfter)}` : `+${btc(lp.btcAfter - lp.btcBefore)}` },
    { label: dropLabel, value: `≈ ${musd(lp.valueAfterDrop)}` },
  ];
}

export function spAmountRows(compared: ComparedRoutes | null, connected = true): Row[] {
  if (compared === null) return [];
  const { sp } = compared;
  return [
    { label: "Position after", value: musd(sp.positionValue), sub: "Stays in MUSD until liquidations" },
    { label: "BTC exposure", value: connected ? `${btc(sp.btcBefore)} → ${btc(sp.btcAfter)}` : "None until a liquidation" },
    { label: `If BTC drops ${STRESS_DROP}%`, value: musd(sp.valueAfterDrop), sub: "New liquidations not modelled" },
  ];
}

const MEZO_CAVEAT = "Changes weekly with veBTC votes; MEZO's price can fall.";

/**
 * The staked alternative to swap fees, as its own rows: never summed with fees, because staking sends
 * swap fees to veBTC voters. Always this week's rate; between weeks there is no rate to show.
 */
export function lpGaugeRows(compared: ComparedRoutes | null): Row[] {
  if (compared === null || compared.lp.status !== "ok" || compared.lp.gauge === null) return [];
  const { gauge } = compared.lp;
  const fees: Row = {
    label: "Swap fees (unstaked)",
    value: "Paid to LP held in your wallet",
    sub: "Staking sends swap fees to veBTC voters instead",
  };
  const label = "MEZO, staked, this week's rate";
  if (!gauge.open) return [fees, { label, value: "New week's rate not set yet", sub: "Staking still works." }];
  const apr = gauge.apr === null ? "No APR shown: MEZO has no price here." : `≈ ${formatPercent(gauge.apr, 1)} APR at this week's rate.`;
  return [fees, { label, value: `≈ ${formatToken(gauge.mezoPerWeek, 18, 4)} MEZO a week`, sub: `${apr} ${MEZO_CAVEAT}` }];
}

/** The Stability Pool's real source, with the live debt it can absorb; undefined until that is read. */
export function spSourceNote(troveDebt: bigint | null): string | undefined {
  if (troveDebt === null) return undefined;
  return `Returns come only from liquidations. Open Trove debt today: ${formatToken(troveDebt, 18, 0)} MUSD.`;
}
