import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";

/** The deposit pages pass only the typed amount in the URL. */
export function spDepositQuery(amount: string): string {
  return amount ? `?${new URLSearchParams({ amount }).toString()}` : "";
}

/** Withdraw presets are the LP exit's: 25 / 50 / 75 / Max (100, the default). */
export function parseSpWithdrawPercent(params: { get(name: string): string | null }): ExitPercent {
  const percent = Number(params.get("percent"));
  return EXIT_PERCENTS.find((value) => value === percent) ?? 100;
}

export function spWithdrawQuery(percent: ExitPercent): string {
  return `?percent=${percent}`;
}
