import { StatRow } from "@/components/dashboard/StatRow";
import { btc, musd } from "@/components/lp/units";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

/** What the deposit does (Flow E step 1): estimated until the receipt. */
export function SpDepositCard({ preview }: { preview: SpDepositPreview }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">What happens</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Your deposit now">{musd(preview.depositNow)}</StatRow>
        <StatRow label="Pending BTC gain" sub="Paid to your wallet with this deposit">
          {btc(preview.gainPaid)}
        </StatRow>
        {preview.depositAfter !== null && (
          <StatRow label="Deposit after (estimated)" strong>
            {musd(preview.depositAfter)}
          </StatRow>
        )}
        <StatRow label="MezoRoute fee">None (direct protocol call)</StatRow>
        <StatRow label="Network fee (estimated)">{preview.gasCost === null ? "—" : btc(preview.gasCost)}</StatRow>
      </dl>
    </section>
  );
}
