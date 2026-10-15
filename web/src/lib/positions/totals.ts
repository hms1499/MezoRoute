import type { SpView } from "@/lib/stability-pool/position";
import type { PositionView } from "./view";

/** The /positions header (U1 §7): estimated value and BTC across the LP, unclaimed pool fees, and the Stability Pool. */
export function positionTotals(view: PositionView, pool: SpView | null): { value: bigint; btc: bigint } {
  const sp = pool && !pool.empty ? pool : null;
  return {
    value: view.lp.value + view.fees.total + (sp?.value ?? 0n),
    btc: view.lp.btc + view.fees.btc + (sp?.gain ?? 0n),
  };
}
