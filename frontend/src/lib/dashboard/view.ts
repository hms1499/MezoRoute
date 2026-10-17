export type DashboardView = "content" | "error" | "loading";

/**
 * What the dashboard renders. Data on screen wins: a failed background refetch keeps the last
 * snapshot instead of an error card. Readiness waits for the wallet kind, so a standard wallet never
 * flashes the smart-account state first.
 */
export function dashboardView(input: { hasData: boolean; walletKindKnown: boolean; hasError: boolean }): DashboardView {
  if (input.hasData && input.walletKindKnown) return "content";
  if (!input.hasData && input.hasError) return "error";
  return "loading";
}
