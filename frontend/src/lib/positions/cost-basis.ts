import type { HistoryEvent } from "./history";

/**
 * MUSD cost of the LP MezoRoute put in the wallet (spec §12 "Cost basis"): entries add
 * `musdIn − musdRefund − btcRefund at the entry's swap price` (the execution fee is inside it), exits
 * remove cost pro rata by LP. "Covered" is the part of the current balance that has a cost basis.
 */
export type CostBasis = {
  attributedLp: bigint; // LP entered through MezoRoute minus LP exited through it
  basis: bigint; // MUSD cost of attributedLp
  coveredLp: bigint; // min(balance, attributedLp)
  coveredBasis: bigint;
  coveredFees: bigint; // MezoRoute fees inside coveredBasis
  unattributedLp: bigint; // LP from elsewhere: no cost basis
};

export function costBasis(events: HistoryEvent[], lpBalance: bigint): CostBasis {
  let lp = 0n;
  let basis = 0n;
  let fees = 0n;
  for (const item of events) {
    if (item.kind === "entered") {
      const entry = item.event;
      const btcRefundValue = entry.btcFromSwap > 0n ? (entry.btcRefund * entry.musdSwapped) / entry.btcFromSwap : 0n;
      lp += entry.liquidityOut;
      basis += entry.musdIn - entry.musdRefund - btcRefundValue;
      fees += entry.fee;
    } else if (lp > 0n) {
      const removed = item.event.liquidityIn < lp ? item.event.liquidityIn : lp;
      basis -= (basis * removed) / lp;
      fees -= (fees * removed) / lp;
      lp -= removed;
    }
  }
  const coveredLp = lpBalance < lp ? lpBalance : lp;
  const share = (value: bigint) => (lp === 0n ? 0n : (value * coveredLp) / lp);
  return {
    attributedLp: lp,
    basis,
    coveredLp,
    coveredBasis: share(basis),
    coveredFees: share(fees),
    unattributedLp: lpBalance - coveredLp,
  };
}
