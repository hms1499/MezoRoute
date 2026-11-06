import type { ReactNode } from "react";
import { ActionCard } from "@/components/flow/ActionCard";
import { Details } from "@/components/flow/Details";
import { Overview, type OverviewRow } from "@/components/flow/Overview";
import { ReceiveRow } from "@/components/flow/ReceiveRow";
import { SlippagePopover } from "@/components/flow/SlippagePopover";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { ButtonLink } from "@/components/ui/Button";
import { PairIcon, type Token } from "@/components/ui/TokenIcon";
import type { LpAmountField } from "@/lib/flow/lp-entry";
import type { SlippageBps } from "@/lib/quote/entry";

// U11 §6.2: the LP amount page's one card (MUSD, BTC, Borrow & Deploy) and the Details below it. The page computes
// every figure; this file only places them, so it renders without wallet providers in tests.

export function LpEntryCard({
  header,
  tabs,
  slippageBps,
  onSlippage,
  field,
  receive,
  stake,
  overview,
  notices,
  risk,
  review,
  details,
}: {
  header: { label: string; value: string };
  tabs: ReactNode;
  slippageBps: SlippageBps;
  onSlippage: (bps: SlippageBps) => void;
  field: LpAmountField & { amount: string; onAmount: (amount: string) => void; onToken?: (token: Token) => void; note?: ReactNode };
  receive: { value: string; minimum: string } | null;
  stake: ReactNode;
  overview: OverviewRow[];
  /** Block reasons with their recoveries, the 2% warning, and the gauge notices: above the action. */
  notices: ReactNode;
  risk: string;
  review: { href: string; disabled: boolean };
  details: ReactNode;
}) {
  return (
    <>
      <ActionCard
        icon={<PairIcon tokens={["musd", "btc"]} size={24} />}
        title="MUSD / BTC"
        subtitle="Volatile pool · Tigris"
        figure={header.value}
        figureLabel={header.label}
        tabs={tabs}
        settings={<SlippagePopover slippageBps={slippageBps} onChange={onSlippage} />}
        risk={
          <>
            {risk} ·{" "}
            <a href="#details" className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
              Details
            </a>
          </>
        }
        action={
          <ButtonLink href={review.href} disabled={review.disabled} className="w-full" arrow>
            Review
          </ButtonLink>
        }
      >
        <TokenAmountInput
          id="amount"
          label={field.label}
          amount={field.amount}
          onAmount={field.onAmount}
          token={field.token}
          tokens={field.tokens}
          onToken={field.onToken}
          balance={field.balance}
          balanceLabel={field.balanceLabel}
          max={field.max}
          note={field.note}
        />
        {receive && (
          <ReceiveRow value={receive.value} minimum={receive.minimum} icon={<PairIcon tokens={["musd", "btc"]} size={20} />} />
        )}
        {stake}
        {overview.length > 0 && <Overview rows={overview} />}
        {notices}
      </ActionCard>
      <Details>{details}</Details>
    </>
  );
}
