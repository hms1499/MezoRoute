import { exposure } from "@/lib/exposure/exposure";
import { formatPercent, formatToken } from "@/lib/format";
import { collateralRatio } from "@/lib/trove/health";
import type { DashboardData } from "./useDashboardSnapshot";

export type SummaryItem = { label: string; value: string; tone?: "btc" };

/** The dashboard's top strip (U1 §4): wallet MUSD, gas, total BTC exposure, Trove CR. */
export function summaryItems(data: DashboardData): SummaryItem[] {
  const { snapshot, gasBalance } = data;
  const cr = snapshot.trove ? collateralRatio(snapshot.trove, snapshot.price) : null;
  return [
    { label: "MUSD in wallet", value: formatToken(snapshot.musd, 18, 2) },
    { label: "BTC for gas", value: formatToken(gasBalance) },
    { label: "BTC exposure", value: formatToken(exposure(snapshot).totalBtc), tone: "btc" },
    { label: "Trove CR", value: snapshot.trove ? (cr === null ? "No debt" : formatPercent(cr)) : "No Trove" },
  ];
}
