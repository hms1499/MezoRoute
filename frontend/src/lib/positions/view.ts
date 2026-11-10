import type { OverviewRow } from "@/components/flow/Overview";
import { formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { quoteExit, type ExitQuote } from "@/lib/quote/exit";
import { costBasis, type CostBasis } from "./cost-basis";
import type { HistoryEvent } from "./history";
import type { PositionsSnapshot } from "./snapshot";

export type LpView = {
  balance: bigint; // walletLp + stakedLp
  walletLp: bigint;
  stakedLp: bigint; // in the gauge, earning MEZO instead of pool fees
  share: bigint; // of the pool, 1e18 = 100%
  musd: bigint; // what burn would pay now
  btc: bigint;
  btcValue: bigint; // btc at the price feed
  value: bigint; // musd + btcValue
  exit: ExitQuote | null; // exiting everything now, before slippage
  cost: CostBasis | null; // null while the history loads or fails
  valueChange: bigint | null; // exit value of the covered LP − its cost; null without covered LP
};
export type FeesView = { musd: bigint; btc: bigint; btcValue: bigint; total: bigint };
export type PositionView = { lp: LpView; fees: FeesView; empty: boolean };

/** Positions screen values (spec Flow F) from one snapshot and, once loaded, the event history. */
export function positionView(snapshot: PositionsSnapshot, events: HistoryEvent[] | null): PositionView {
  const { pool, price } = snapshot;
  const walletLp = snapshot.lpBalance;
  const stakedLp = snapshot.gauge?.staked ?? 0n;
  const balance = walletLp + stakedLp;
  const supply = pool.totalSupply;
  const musd = supply === 0n ? 0n : (balance * pool.balanceMusd) / supply;
  const btc = supply === 0n ? 0n : (balance * pool.balanceBtc) / supply;
  const btcValue = (btc * price) / WAD;
  const exit = balance > 0n ? quoteExit(pool, balance) : null;
  const cost = events ? costBasis(events, balance) : null;
  const valueChange =
    cost && exit && cost.coveredLp > 0n ? (exit.musdOut * cost.coveredLp) / balance - cost.coveredBasis : null;
  const feesBtcValue = (snapshot.fees.btc * price) / WAD;
  return {
    lp: {
      balance,
      walletLp,
      stakedLp,
      share: supply === 0n ? 0n : (balance * WAD) / supply,
      musd,
      btc,
      btcValue,
      value: musd + btcValue,
      exit,
      cost,
      valueChange,
    },
    fees: { ...snapshot.fees, btcValue: feesBtcValue, total: snapshot.fees.musd + feesBtcValue },
    // Unstaked LP can still hold pending MEZO, so that counts as something to show.
    empty: balance === 0n && snapshot.fees.musd === 0n && snapshot.fees.btc === 0n && (snapshot.gauge?.earned ?? 0n) === 0n,
  };
}

/** Whether Positions says "you have no positions": both sides known empty. A failed gauge read cannot tell, because the LP may all be staked. */
export function showsNoPositions(view: PositionView, pool: { empty: boolean } | null, gaugeReadFailed: boolean): boolean {
  return view.empty && pool?.empty === true && !gaugeReadFailed;
}

/** LP exit's aside (U14): wallet LP, staked LP (unknown when the gauge read failed), and the pool fees to claim. */
export function exitPositionRows(s: PositionsSnapshot): OverviewRow[] {
  const lp = (v: bigint) => `${formatToken(v)} LP`;
  return [
    { label: "In your wallet", value: lp(s.lpBalance) },
    ...(s.gauge ? [{ label: "Staked", value: s.gaugeReadFailed ? "Unknown" : lp(s.gauge.staked) }] : []),
    { label: "Pool fees to claim", value: `${formatToken(s.fees.musd, 18, 4)} MUSD`, sub: `+ ${formatToken(s.fees.btc, 18, 8)} BTC` },
  ];
}
