"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { lp as lpUnits, musd } from "@/components/lp/units";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { gaugeActionBlock, type GaugeAction } from "@/lib/gauge/actions";
import { stakeAvailability } from "@/lib/gauge/availability";
import { GAUGE_NOT_FUNDED, gaugeRateLine } from "@/lib/gauge/copy";
import { emissionsApr, gaugeWeekOpen, mezoPerWeek } from "@/lib/gauge/maths";
import type { GaugeState } from "@/lib/gauge/state";
import { useGaugeActions } from "@/lib/gauge/useGaugeActions";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { formatPercent, formatToken } from "@/lib/format";
import type { PositionsData } from "@/lib/positions/snapshot";
import type { LpView } from "@/lib/positions/view";

const mezo = (value: bigint) => `${formatToken(value, 18, 4)} MEZO`;
const FEES_NOTE = "While staked, swap fees go to veBTC voters instead of you.";

/** Staked LP, pending MEZO, and the three direct gauge actions. Rates are always this week's; they are not a promise. */
export function GaugeCard({ account, lp, data, gauge }: { account: Address; lp: LpView; data: PositionsData; gauge: GaugeState }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { snapshot } = data;
  const actions = useGaugeActions(account);
  const mezoPrice = useMezoPrice(network, snapshot.blockNumber);
  const open = gaugeWeekOpen(gauge, snapshot.blockTimestamp);
  const availability = stakeAvailability(gauge, snapshot.blockTimestamp);
  const stakeOffered = availability !== "unavailable";

  const blockFor = (action: GaugeAction) =>
    gaugeActionBlock({
      network,
      walletChainId: chainId,
      action,
      state: gauge,
      walletLp: lp.walletLp,
      lacksGas: lacksGas(data.gasBalance, data.gasPrice),
      now: snapshot.blockTimestamp,
    });
  const claim = blockFor("claim");
  const stake = blockFor("stake");
  const unstake = blockFor("unstake");
  // "Nothing to do" is already clear from the missing or disabled button; the notice is for what the user can fix.
  const notice = [claim, stake, unstake].find((block) => block && block.reason !== "nothing-to-do") ?? null;

  const weekly = gauge.staked > 0n && open ? mezoPerWeek(gauge.rewardRate, gauge.staked, gauge.totalStaked - gauge.staked) : null;
  const apr = open
    ? emissionsApr({ rewardRate: gauge.rewardRate, mezoPrice, userLp: 0n, totalStaked: gauge.totalStaked, pool: snapshot.pool })
    : null;
  const earnedValue = mezoPrice === null ? null : (gauge.earned * mezoPrice) / 10n ** 18n;
  const busy = actions.pending !== null;

  return (
    <Card
      title={<Term id="gauge">MEZO gauge</Term>}
      subtitle={stakeOffered ? "Staked LP earns MEZO instead of pool fees." : undefined}
      aside={
        <div className="text-right">
          <p className="text-xs text-muted">Pending MEZO</p>
          <p className="font-mono text-xl font-medium">{mezo(gauge.earned)}</p>
        </div>
      }
    >
      <dl className="mt-3 stat-list">
        <Stat label="Staked LP" sub={lp.balance > 0n ? `${formatPercent((gauge.staked * 10n ** 18n) / lp.balance, 1)} of your LP` : undefined}>
          {lpUnits(gauge.staked)}
        </Stat>
        <Stat label="Pending MEZO" sub={earnedValue === null ? undefined : `≈ ${musd(earnedValue)}`} strong>
          {mezo(gauge.earned)}
        </Stat>
        <Stat label={<Term id="emissions">Emissions</Term>} sub="At this week's rate, which can change">
          {gaugeRateLine(availability, weekly)}
        </Stat>
        {apr !== null && (
          <Stat label="Emissions APR" sub="At this week's rate only; not a promise">
            {formatPercent(apr, 1)}
          </Stat>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted">{FEES_NOTE}</p>
      {!stakeOffered && gauge.staked > 0n && (
        <Notice tone="warning" role="status" className="mt-3">
          {GAUGE_NOT_FUNDED}
        </Notice>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={claim !== null || busy} pending={actions.pending === "claim" ? "wallet" : null} onClick={actions.claim}>
          Claim MEZO
        </Button>
        {gauge.staked > 0n && (
          <Button variant="secondary" disabled={unstake !== null || busy} pending={actions.pending === "unstake" ? "wallet" : null} onClick={actions.unstakeAll}>
            Unstake all
          </Button>
        )}
        {lp.walletLp > 0n && stakeOffered && (
          <Button variant="secondary" disabled={stake !== null || busy} pending={actions.pending === "stake" ? "wallet" : null} onClick={actions.stakeAll}>
            Stake all
          </Button>
        )}
      </div>
      {notice?.outcome && (
        <div className="mt-3">
          <BlockNotice block={notice} />
        </div>
      )}
    </Card>
  );
}
