"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { formatPercent } from "@/lib/format";
import { gaugeActionBlock, type GaugeAction } from "@/lib/gauge/actions";
import { showsGaugeCard, stakeAvailability } from "@/lib/gauge/availability";
import { feesStakedNote, gaugeRateLine } from "@/lib/gauge/copy";
import { emissionsApr, gaugeWeekOpen, mezoPerWeek } from "@/lib/gauge/maths";
import { useGaugeActions } from "@/lib/gauge/useGaugeActions";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import type { ClaimBlock } from "@/lib/positions/claim";
import type { PositionsData } from "@/lib/positions/snapshot";
import { useClaimFees } from "@/lib/positions/useClaimFees";
import type { PositionView } from "@/lib/positions/view";
import type { SpBlock } from "@/lib/stability-pool/gate";
import type { SpView } from "@/lib/stability-pool/position";
import { RewardsCard, type RewardsCardProps } from "./RewardsCard";

/** Reasons that only mean "nothing to do here": the empty state or a disabled button already says so. */
const QUIET: readonly string[] = ["nothing-to-do", "nothing-to-claim", "no-gain"];

/** The Rewards card's data and actions: the gauge's direct calls, Pool.claimFees, and the Stability Pool claim (U11 §6.4). */
export function Rewards({
  account,
  view,
  data,
  feesBlock,
  sp,
}: {
  account: Address;
  view: PositionView;
  data: PositionsData;
  feesBlock: ClaimBlock | null;
  sp: { view: SpView; block: SpBlock | null; onClaim: () => void; claiming: boolean } | null;
}) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { snapshot } = data;
  const gauge = snapshot.gauge;
  const actions = useGaugeActions(account);
  const fees = useClaimFees(account);
  const mezoPrice = useMezoPrice(network, snapshot.blockNumber);
  const busy = actions.pending !== null;

  const blockFor = (action: GaugeAction) =>
    gauge &&
    gaugeActionBlock({
      network,
      walletChainId: chainId,
      action,
      state: gauge,
      walletLp: view.lp.walletLp,
      lacksGas: lacksGas(data.gasBalance, data.gasPrice),
      now: snapshot.blockTimestamp,
    });
  const blocks = { claim: blockFor("claim"), stake: blockFor("stake"), unstake: blockFor("unstake") };

  let mezo: RewardsCardProps["mezo"] = null;
  if (snapshot.gaugeReadFailed) mezo = "read-failed";
  else if (showsGaugeCard(gauge, view.lp.walletLp, snapshot.blockTimestamp)) {
    const open = gaugeWeekOpen(gauge, snapshot.blockTimestamp);
    const availability = stakeAvailability(gauge, snapshot.blockTimestamp);
    const weekly = gauge.staked > 0n && open ? mezoPerWeek(gauge.rewardRate, gauge.staked, gauge.totalStaked - gauge.staked) : null;
    const apr = open ? emissionsApr({ rewardRate: gauge.rewardRate, mezoPrice, userLp: 0n, totalStaked: gauge.totalStaked, pool: snapshot.pool }) : null;
    mezo = {
      pending: gauge.earned,
      rate: gaugeRateLine(availability, weekly),
      apr: apr === null ? null : formatPercent(apr, 1),
      staked: gauge.staked,
      walletLp: view.lp.walletLp,
      stakeOffered: availability !== "unavailable",
      notFunded: availability === "unavailable",
      claim: { onClick: actions.claim, disabled: blocks.claim !== null || busy, pending: actions.pending === "claim" },
      stake: { onClick: actions.stakeAll, disabled: blocks.stake !== null || busy, pending: actions.pending === "stake" },
      unstake: { onClick: actions.unstakeAll, disabled: blocks.unstake !== null || busy, pending: actions.pending === "unstake" },
    };
  }

  const hasLp = view.lp.balance > 0n || view.fees.musd > 0n || view.fees.btc > 0n;
  // "Nothing to do" is clear from the missing or disabled button; a notice is for what the user can fix.
  const notice = [blocks.claim, blocks.stake, blocks.unstake, feesBlock, sp?.block].find(
    (block) => block && !QUIET.includes(block.reason),
  );
  return (
    <RewardsCard
      mezo={mezo}
      fees={
        hasLp
          ? {
              musd: view.fees.musd,
              btc: view.fees.btc,
              total: view.fees.total,
              note: feesStakedNote({ walletLp: view.lp.walletLp, stakedLp: view.lp.stakedLp, fees: view.fees }),
              claim: { onClick: fees.claim, disabled: feesBlock !== null, pending: fees.pending },
            }
          : null
      }
      btcGain={
        sp && sp.view.gain > 0n
          ? { amount: sp.view.gain, value: sp.view.gainValue, claim: { onClick: sp.onClaim, disabled: sp.block !== null, pending: sp.claiming } }
          : null
      }
      notice={notice?.outcome ? <BlockNotice block={notice} /> : null}
    />
  );
}
