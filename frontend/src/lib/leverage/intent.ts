import { formatUnits, parseUnits } from "viem";
import { parseSlippage, slippageParam } from "@/lib/routes/musd-btc-lp/intent";

export type TroveAction = "unwind" | "close" | "leverage" | "open";

/** What the user asked for; the only state the Trove pages pass between them (in the URL). */
export type TroveIntent = { cr: bigint | null; btc: bigint | null; slippageBps: bigint };

const USES_CR: Record<TroveAction, boolean> = { unwind: true, close: false, leverage: true, open: true };
const USES_BTC: Record<TroveAction, boolean> = { unwind: false, close: false, leverage: false, open: true };
const DECIMAL = /^\d+(\.\d+)?$/;

function parsePositive(value: string | null, decimals: number): bigint | null {
  if (value === null || !DECIMAL.test(value)) return null;
  try {
    const parsed = parseUnits(value, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

/** `cr` is a percent ("250" = 250%, 1e18 = 100%); `btc` is BTC; `slippage` one of the LP route's presets. */
export function parseIntent(action: TroveAction, params: { get(name: string): string | null }): TroveIntent {
  return {
    cr: USES_CR[action] ? parsePositive(params.get("cr"), 16) : null,
    btc: USES_BTC[action] ? parsePositive(params.get("btc"), 18) : null,
    slippageBps: parseSlippage(params.get("slippage")),
  };
}

export function intentQuery(action: TroveAction, intent: TroveIntent): string {
  const query = new URLSearchParams();
  if (USES_CR[action] && intent.cr !== null) query.set("cr", formatUnits(intent.cr, 16));
  if (USES_BTC[action] && intent.btc !== null) query.set("btc", formatUnits(intent.btc, 18));
  query.set("slippage", slippageParam(intent.slippageBps as Parameters<typeof slippageParam>[0]));
  return query.toString();
}
