import { StatRow } from "@/components/dashboard/StatRow";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exposure } from "@/lib/exposure/exposure";
import { btc } from "./units";

/** BTC exposure before → after the deposit (Flows C and E, FR-15). */
export function ExposureChange({ before, after }: { before: DashboardSnapshot; after: DashboardSnapshot }) {
  const now = exposure(before);
  const next = exposure(after);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Your BTC exposure</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="MUSD/BTC pool (your share)">
          {btc(now.lpBtc)} → {btc(next.lpBtc)}
        </StatRow>
        {(now.spDeposit > 0n || next.spDeposit > 0n || now.spBtcGain > 0n) && (
          <StatRow label="Stability Pool BTC gain">
            {btc(now.spBtcGain)} → {btc(next.spBtcGain)}
          </StatRow>
        )}
        <StatRow label="Total BTC exposure" strong>
          {btc(now.totalBtc)} → {btc(next.totalBtc)}
        </StatRow>
      </dl>
    </section>
  );
}
