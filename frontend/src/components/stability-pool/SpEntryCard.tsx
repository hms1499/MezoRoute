import type { ReactNode } from "react";
import { ActionCard } from "@/components/flow/ActionCard";
import { Details } from "@/components/flow/Details";
import { Overview, type OverviewRow } from "@/components/flow/Overview";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { ButtonLink } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";

// U11 §6.2: the Stability Pool amount page's one card. Its header names the return in words, never as a rate (the
// pool's returns come in bursts, so it is never annualised).

export const SP_FIGURE = "No fee · BTC from liquidations";
const SP_RISK_LINE = "Your deposit shrinks when it repays liquidated debt; you receive BTC instead";

export function SpEntryCard({
  field,
  overview,
  notices,
  review,
  details,
}: {
  field: { amount: string; onAmount: (amount: string) => void; balance: bigint };
  overview: OverviewRow[];
  notices: ReactNode;
  review: { href: string; disabled: boolean };
  details: ReactNode;
}) {
  return (
    <>
      <ActionCard
        icon={<TokenIcon token="musd" size={24} />}
        title="Stability Pool"
        subtitle="Mezo · MUSD deposits"
        figure={SP_FIGURE}
        risk={
          <>
            {SP_RISK_LINE} ·{" "}
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
          label="You deposit"
          amount={field.amount}
          onAmount={field.onAmount}
          token="musd"
          balance={field.balance}
          max={field.balance}
        />
        {overview.length > 0 && <Overview rows={overview} />}
        {notices}
      </ActionCard>
      <Details>{details}</Details>
    </>
  );
}
