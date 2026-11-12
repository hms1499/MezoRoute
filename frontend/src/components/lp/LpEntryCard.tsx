import type { ReactNode } from "react";
import { ActionCard } from "@/components/flow/ActionCard";
import { TrustLine } from "@/components/flow/BeforeYouSign";
import { Details } from "@/components/flow/Details";
import { Overview, type OverviewRow } from "@/components/flow/Overview";
import { ReceiveRow } from "@/components/flow/ReceiveRow";
import { SlippagePopover } from "@/components/flow/SlippagePopover";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { Button, ButtonLink } from "@/components/ui/Button";
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
  overview,
  notices,
  risk,
  action,
  context,
  details,
  trust,
}: {
  header: { label: string; value: string };
  tabs: ReactNode;
  slippageBps: SlippageBps;
  onSlippage: (bps: SlippageBps) => void;
  field: LpAmountField & { amount: string; onAmount: (amount: string) => void; onToken?: (token: Token) => void; note?: ReactNode; error?: string | null };
  receive: { value: string; minimum: string; note?: string | null } | null;
  overview: OverviewRow[];
  /** Block reasons with their recoveries, the 2% warning, and the gauge notices: above the action. */
  notices: ReactNode;
  risk: string;
  /**
   * The page's one primary: Review, or the way out while the entry is blocked. `node` (U13) is the page's own
   * control (Connect to review); it owns its label and arrow, so nothing else renders in the slot.
   */
  action: { label: ReactNode; href?: string; onClick?: () => void; external?: boolean; disabled?: boolean; node?: ReactNode };
  /** Context rows (exposure, Trove change, network fee) shown in Details, not before the action. */
  context?: OverviewRow[];
  details: ReactNode;
  /** U17: one line pointing at Before you sign, shown below lg only. */
  trust?: string | null;
}) {
  return (
    <>
      <ActionCard
        icon={<PairIcon tokens={["musd", "btc"]} size={24} />}
        title="MUSD / BTC"
        subtitle="MUSD/BTC pool on Tigris"
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
          action.node ? (
            action.node
          ) : action.disabled ? (
            <ButtonLink href={action.href ?? "#"} disabled className="w-full">
              {action.label}
            </ButtonLink>
          ) : action.href ? (
            <ButtonLink href={action.href} external={action.external} className="w-full" arrow={!action.external}>
              {action.label}
            </ButtonLink>
          ) : (
            <Button onClick={action.onClick} className="w-full" arrow>
              {action.label}
            </Button>
          )
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
          error={field.error ?? undefined}
        />
        {receive && (
          <ReceiveRow
            value={receive.value}
            minimum={receive.minimum}
            note={receive.note}
            noteAction={
              receive.note ? (
                <a href="#details" className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
                  Why
                </a>
              ) : undefined
            }
            icon={<PairIcon tokens={["musd", "btc"]} size={20} />}
          />
        )}
        {overview.length > 0 && <Overview rows={overview} />}
        {notices}
        <TrustLine text={trust} />
      </ActionCard>
      <Details>
        {context && context.length > 0 && <Overview rows={context} />}
        {details}
      </Details>
    </>
  );
}
