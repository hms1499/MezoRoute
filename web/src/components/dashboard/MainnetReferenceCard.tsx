"use client";

import { lpHistoryLine, spHistoryLine } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { referenceFooter, referenceView } from "@/lib/reference/snapshot";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { Stat } from "@/components/ui/Stat";

const CARD = "rounded-2xl border border-dashed border-line bg-canvas p-5";

/** Spec §9 screen 1: mainnet's pool and Stability Pool today, kept apart from testnet execution data. */
export function MainnetReferenceCard() {
  const { network } = useNetwork();
  const onTestnet = network.id === "testnet";
  const { data, error, retry } = useMainnetReference(onTestnet);
  if (!onTestnet) return null;

  if (!data && error) {
    return (
      <section id="mainnet-reference" className={CARD}>
        <Header />
        <p className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          Mainnet data unavailable.
          <button type="button" onClick={retry} className="text-xs font-semibold text-accent underline">
            Retry
          </button>
        </p>
      </section>
    );
  }
  if (!data) return <div aria-busy="true" aria-label="Loading mainnet reference" className={`${CARD} h-56 animate-pulse`} />;

  const { reference: r, backtests } = data;
  const view = referenceView(r);
  return (
    <section id="mainnet-reference" className={CARD}>
      <Header />
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">MUSD/BTC pool</h3>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
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
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <Stat label="Deposits">{formatToken(r.spDeposits, 18, 0)} MUSD</Stat>
            <Stat label="Share of MUSD supply" sub={`of ${formatToken(r.musdSupply, 18, 0)} MUSD`}>
              {formatPercent(view.spShare, 1)}
            </Stat>
            <Stat label="Last 30 days">{backtests ? spHistoryLine(backtests.sp) : "Unavailable"}</Stat>
          </dl>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">{referenceFooter(networks.mainnet.executor)}</p>
    </section>
  );
}

function Header() {
  return (
    <h2 className="flex flex-wrap items-center justify-between gap-2 font-semibold">
      Mainnet today
      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
        Mainnet · reference only
      </span>
    </h2>
  );
}
