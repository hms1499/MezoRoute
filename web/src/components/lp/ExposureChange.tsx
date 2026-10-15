import { Stat } from "@/components/ui/Stat";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exposure } from "@/lib/exposure/exposure";
import { btc } from "./units";

/** BTC exposure before → after the deposit (Flows C and E, FR-15). */
export function ExposureChange({ before, after }: { before: DashboardSnapshot; after: DashboardSnapshot }) {
  const now = exposure(before);
  const next = exposure(after);
  return (
    <section className="card">
      <h2 className="font-semibold">Your BTC exposure</h2>
      <dl className="mt-3 stat-list">
        <Stat label="MUSD/BTC pool (your share)">
          {btc(now.lpBtc)} → {btc(next.lpBtc)}
        </Stat>
        {(now.spDeposit > 0n || next.spDeposit > 0n || now.spBtcGain > 0n) && (
          <Stat label="Stability Pool BTC gain">
            {btc(now.spBtcGain)} → {btc(next.spBtcGain)}
          </Stat>
        )}
        <Stat label="Total BTC exposure" strong>
          {btc(now.totalBtc)} → {btc(next.totalBtc)}
        </Stat>
      </dl>
    </section>
  );
}
