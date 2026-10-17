import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";

/** The dashboard snapshot after a Stability Pool deposit: provideToSP also pays the pending BTC gain to the wallet. */
export function afterSpDeposit(snapshot: DashboardSnapshot, musdIn: bigint): DashboardSnapshot {
  return { ...snapshot, musd: snapshot.musd - musdIn, sp: { deposit: snapshot.sp.deposit + musdIn, btcGain: 0n } };
}
