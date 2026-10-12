import { WAD } from "@/lib/math";
import { quoteExit, type ExitQuote } from "@/lib/quote/exit";
import { costBasis, type CostBasis } from "./cost-basis";
import type { HistoryEvent } from "./history";
import type { PositionsSnapshot } from "./snapshot";

export type LpView = {
  balance: bigint;
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
  const { pool, lpBalance: balance, price } = snapshot;
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
    empty: balance === 0n && snapshot.fees.musd === 0n && snapshot.fees.btc === 0n,
  };
}
