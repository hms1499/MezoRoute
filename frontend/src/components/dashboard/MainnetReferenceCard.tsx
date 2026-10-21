"use client";

import { lpHistoryLine, spHistoryLine } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { referenceFooter, referenceView } from "@/lib/reference/snapshot";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Settle } from "@/components/ui/Settle";

/** Spec §9 screen 1: mainnet's pool and Stability Pool today, kept apart from testnet execution data. */
export function MainnetReferenceCard() {
  const { network } = useNetwork();
  const onTestnet = network.id === "testnet";
  const { data, error, retry } = useMainnetReference(onTestnet);
  if (!onTestnet) return null;

  if (!data && error) {
    return (
      <Card id="mainnet-reference" variant="reference" title="Mainnet today" aside={<Badge>Mainnet · reference only</Badge>}>
        <Notice
          className="mt-3"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          Mainnet data unavailable.
        </Notice>
      </Card>
    );
  }
  if (!data) return <LoadingCard label="Loading mainnet reference" lines={5} />;

  const { reference: r, backtests } = data;
  const view = referenceView(r);
  return (
    <Settle>
      <Card id="mainnet-reference" variant="reference" title="Mainnet today" aside={<Badge>Mainnet · reference only</Badge>}>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">MUSD/BTC pool</h3>
            <dl className="stat-list mt-2">
              <Stat label="Reserves" sub={`+ ${formatToken(r.reserveBtc, 18, 4)} BTC`}>
                {formatToken(r.reserveMusd, 18, 0)} MUSD
              </Stat>
              <Stat label="Value">≈ {formatToken(view.poolTvl, 18, 0)} MUSD</Stat>
              <Stat label="Swap fee">{formatBps(r.feeBps)}</Stat>
              <Stat label="LP fees, last 30 days">{backtests?.lp ? lpHistoryLine(backtests.lp) : "Unavailable"}</Stat>
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-medium">Stability Pool</h3>
            <dl className="stat-list mt-2">
              <Stat label="Deposits">{formatToken(r.spDeposits, 18, 0)} MUSD</Stat>
              <Stat label="Share of MUSD supply" sub={`of ${formatToken(r.musdSupply, 18, 0)} MUSD`}>
                {formatPercent(view.spShare, 1)}
              </Stat>
              <Stat label="Last 30 days">{backtests ? spHistoryLine(backtests.sp) : "Unavailable"}</Stat>
            </dl>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{referenceFooter(networks.mainnet.executor)}</p>
      </Card>
    </Settle>
  );
}
