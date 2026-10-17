import type { ReactNode } from "react";
import { btc, musd } from "@/components/lp/units";
import { STRESS_DROP, type ComparedRoutes } from "@/lib/compare/comparison";
import { formatBps, formatPercent } from "@/lib/format";

export type Row = { label: string; title?: string; value: ReactNode; sub?: string };

export function lpFee(executorFeeBps: bigint | null, compared: ComparedRoutes | null): string {
  if (executorFeeBps === null) return "Set at launch";
  if (compared?.lp.status === "ok") return `${formatBps(executorFeeBps)} (${musd(compared.lp.fee)})`;
  return formatBps(executorFeeBps);
}

/** Rows that need an amount; none until one is entered. */
export function lpAmountRows(compared: ComparedRoutes | null): Row[] {
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
    { label: "BTC exposure", value: `${btc(lp.btcBefore)} → ${btc(lp.btcAfter)}` },
    { label: dropLabel, value: `≈ ${musd(lp.valueAfterDrop)}` },
  ];
}

export function spAmountRows(compared: ComparedRoutes | null): Row[] {
  if (compared === null) return [];
  const { sp } = compared;
  return [
    { label: "Position after", value: musd(sp.positionValue), sub: "Stays in MUSD until liquidations" },
    { label: "BTC exposure", value: `${btc(sp.btcBefore)} → ${btc(sp.btcAfter)}` },
    { label: `If BTC drops ${STRESS_DROP}%`, value: musd(sp.valueAfterDrop), sub: "New liquidations not modelled" },
  ];
}
