import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
import { formatPercent, formatToken } from "@/lib/format";
import { REDEMPTION_EXPLAINER } from "@/lib/leverage/copy";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { GAS_COMPENSATION } from "@/lib/trove/constants";
import type { TroveSummary } from "@/lib/trove/page";

const bpsPercent = (bps: bigint) => formatPercent(bps * 10n ** 14n, 0);

/** U20 §4: where redemptions would reach this Trove. */
export function QueueCard({ redemption }: { redemption: TroveSummary["redemption"] }) {
  return (
    <Card
      title={
        <>
          <Term id="redemption">Redemption</Term> queue
        </>
      }
    >
      {typeof redemption === "object" ? (
        <dl className="stat-list mt-3">
          <Stat label="Debt ahead of yours" sub={`${formatPercent(redemption.share)} of all debt`}>
            {formatToken(redemption.debtAhead, 18, 0)} MUSD
          </Stat>
          <Stat label="Place">
            {redemption.rank} of {redemption.total}
          </Stat>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {redemption === "unreadable" ? "The queue could not be read just now." : "Redemptions skip a Trove below the 110% minimum."}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">{REDEMPTION_EXPLAINER}</p>
    </Card>
  );
}

/** U20 §4: what the Trove costs. */
export function BorrowingCard({ snapshot }: { snapshot: TroveSnapshot }) {
  const t = snapshot.trove!;
  return (
    <Card title="Borrowing">
      <dl className="stat-list mt-3">
        <Stat label="Interest" sub="fixed for this Trove">
          {bpsPercent(t.interestRateBps)} a year
        </Stat>
        <Stat label="Borrowing fee" sub="on new debt">
          {formatPercent(snapshot.market.borrowingRate)}
        </Stat>
        <Stat label="Gas deposit" sub="in the debt, returned on close">
          {formatToken(GAS_COMPENSATION, 18, 0)} MUSD
        </Stat>
      </dl>
    </Card>
  );
}

/** U20 §4/§5: the system as it stands; Recovery Mode is also a notice when it is on. */
export function MezoNowCard({ snapshot, withPrice = false }: { snapshot: TroveSnapshot; withPrice?: boolean }) {
  const { system, market } = snapshot;
  const tcr = system.debt === 0n ? null : (system.coll * market.price) / system.debt;
  return (
    <Card title="Mezo now">
      <dl className="stat-list mt-3">
        <Stat label="System ratio">{tcr === null ? "—" : formatPercent(tcr)}</Stat>
        <Stat label={<Term id="recoveryMode">Recovery Mode</Term>} sub={`starts below ${formatPercent(system.ccr, 0)}`}>
          {snapshot.recoveryMode ? "On" : "Off"}
        </Stat>
        <Stat label="Open Troves">{system.troveCount.toLocaleString("en-US")}</Stat>
        {withPrice && (
          <Stat label="BTC price" sub={`Mezo's oracle · block ${snapshot.block.number.toLocaleString("en-US")}`}>
            {formatToken(market.price, 18, 0)} MUSD
          </Stat>
        )}
      </dl>
    </Card>
  );
}
