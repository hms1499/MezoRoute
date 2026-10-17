import type { SpView } from "@/lib/stability-pool/position";
import type { PositionView } from "./view";

/**
 * The /positions header (U1 §7): estimated value and BTC across the LP, unclaimed pool fees, and the
 * Stability Pool. `null` pool means its read failed: no total, rather than one that silently leaves it out.
 */
export function positionTotals(view: PositionView, pool: SpView | null): { value: bigint; btc: bigint } | null {
  if (pool === null) return null;
  const sp = pool.empty ? null : pool;
  return {
    value: view.lp.value + view.fees.total + (sp?.value ?? 0n),
    btc: view.lp.btc + view.fees.btc + (sp?.gain ?? 0n),
  };
}
