import type { ReactNode } from "react";
import { btc, musd } from "@/components/lp/units";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Term } from "@/components/ui/Term";
import { formatToken } from "@/lib/format";
import { GAUGE_NOT_FUNDED, GAUGE_READ_FAILED_POSITIONS } from "@/lib/gauge/copy";

// U11 §6.4: one Rewards card (it merges the gauge card and the pool-fees card): pending MEZO with Claim MEZO, the
// pool's unclaimed fees with Claim fees, the Stability Pool's BTC gain with its claim, and Stake all / Unstake all.
// Rates are this week's only; staking copy says swap fees go to veBTC voters. Every action is secondary or ghost.

export type RewardAction = { onClick: () => void; disabled: boolean; pending: boolean };

export type RewardsCardProps = {
  /** null: the network has no gauge to show; "read-failed": its reads failed, so nothing here may say 0. */
  mezo:
    | null
    | "read-failed"
    | {
        pending: bigint;
        rate: string;
        apr: string | null;
        staked: bigint;
        walletLp: bigint;
        stakeOffered: boolean;
        notFunded: boolean;
        claim: RewardAction;
        stake: RewardAction;
        unstake: RewardAction;
      };
  fees: { musd: bigint; btc: bigint; total: bigint; note: string | null; claim: RewardAction } | null;
  btcGain: { amount: bigint; value: bigint; claim: RewardAction } | null;
  /** Block reasons the user can fix (wrong network, gas). */
  notice: ReactNode;
};

const FEES_NOTE = "While staked, swap fees go to veBTC voters instead of you.";

function ActionButton({ action, children, variant = "secondary" }: { action: RewardAction; children: ReactNode; variant?: "secondary" | "ghost" }) {
  return (
    <Button variant={variant} size="md" disabled={action.disabled} pending={action.pending ? "wallet" : null} onClick={action.onClick}>
      {children}
    </Button>
  );
}

function Line({ label, value, sub, action }: { label: ReactNode; value: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-medium">{value}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function RewardsCard({ mezo, fees, btcGain, notice }: RewardsCardProps) {
  const feesClaimable = fees !== null && (fees.musd > 0n || fees.btc > 0n);
  return (
    <Card title="Rewards">
      <div className="mt-1">
        {mezo === "read-failed" && (
          <Notice tone="warning" role="status" className="my-3">
            {GAUGE_READ_FAILED_POSITIONS}
          </Notice>
        )}
        {mezo !== null && mezo !== "read-failed" && (
          <>
            <Line
              label={
                <>
                  Pending MEZO from the <Term id="gauge">gauge</Term>
                </>
              }
              value={`${formatToken(mezo.pending, 18, 4)} MEZO`}
              sub={`${mezo.rate}${mezo.apr ? ` · ${mezo.apr} APR at this week's rate` : ""}`}
              action={<ActionButton action={mezo.claim}>Claim MEZO</ActionButton>}
            />
            {mezo.notFunded && mezo.staked > 0n && (
              <Notice tone="warning" role="status" className="my-3">
                {GAUGE_NOT_FUNDED}
              </Notice>
            )}
          </>
        )}
        {fees && (
          <Line
            label="Unclaimed pool fees"
            value={musd(fees.total)}
            sub={feesClaimable ? `${musd(fees.musd)} + ${btc(fees.btc)}` : undefined}
            action={feesClaimable ? <ActionButton action={fees.claim}>Claim fees</ActionButton> : undefined}
          />
        )}
        {fees && !feesClaimable && (
          <Notice className="my-3">
            You have no fees to claim yet.{fees.note ? ` ${fees.note}` : ""}
          </Notice>
        )}
        {btcGain && (
          <Line
            label={
              <>
                Stability Pool <Term id="btcGain">BTC gain</Term>
              </>
            }
            value={btc(btcGain.amount)}
            sub={`≈ ${musd(btcGain.value)}`}
            action={<ActionButton action={btcGain.claim}>Claim BTC gain</ActionButton>}
          />
        )}
      </div>
      {mezo !== null && mezo !== "read-failed" && (
        <div className="mt-3 space-y-2">
          {/* The empty fees notice already says it when all the LP is staked. */}
          {!(fees && !feesClaimable && fees.note) && <p className="text-sm text-muted">{FEES_NOTE}</p>}
          <div className="flex flex-wrap gap-2">
            {mezo.walletLp > 0n && mezo.stakeOffered && (
              <ActionButton action={mezo.stake} variant="ghost">
                Stake all
              </ActionButton>
            )}
            {mezo.staked > 0n && (
              <ActionButton action={mezo.unstake} variant="ghost">
                Unstake all
              </ActionButton>
            )}
          </div>
        </div>
      )}
      {notice && <div className="mt-3">{notice}</div>}
    </Card>
  );
}
