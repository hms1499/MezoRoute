import { DEFAULT_SLIPPAGE, type SlippageBps } from "@/lib/quote/entry";
import { parseSlippage, slippageParam } from "@/lib/routes/musd-btc-lp/intent";

export const EXIT_PERCENTS = [25, 50, 75, 100] as const;
export type ExitPercent = (typeof EXIT_PERCENTS)[number];

/** What the user asked for on the exit page; the only state in its URL. */
export type ExitIntent = { percent: ExitPercent; slippageBps: SlippageBps };
export const DEFAULT_EXIT_INTENT: ExitIntent = { percent: 100, slippageBps: DEFAULT_SLIPPAGE };

export function parseExitIntent(params: { get(name: string): string | null }): ExitIntent {
  const percent = Number(params.get("percent"));
  return {
    percent: EXIT_PERCENTS.find((value) => value === percent) ?? 100,
    slippageBps: parseSlippage(params.get("slippage")),
  };
}

export function exitQuery(intent: ExitIntent): string {
  return `?${new URLSearchParams({ percent: intent.percent.toString(), slippage: slippageParam(intent.slippageBps) }).toString()}`;
}

/** LP to exit: the exact balance at Max (no dust left behind), otherwise the share rounded down. */
export function exitLiquidity(balance: bigint, percent: ExitPercent): bigint {
  return percent === 100 ? balance : (balance * BigInt(percent)) / 100n;
}
