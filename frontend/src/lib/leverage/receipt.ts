import { decodeEventLog, type Address } from "viem";
import { mezoRouteLeverageAbi } from "@/lib/abi/mezoRouteLeverage";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";

export type TroveReceipt =
  | { kind: "unwound"; borrower: Address; debtRepaid: bigint; collWithdrawn: bigint; btcToPool: bigint }
  | { kind: "closed"; borrower: Address; debtRepaid: bigint; collReturned: bigint; btcToPool: bigint }
  | { kind: "leveraged"; borrower: Address; btcAdded: bigint; debtIncrease: bigint; musdToPool: bigint; fee: bigint; musdSurplus: bigint }
  | {
      kind: "opened";
      borrower: Address;
      btcFromUser: bigint;
      btcFlashed: bigint;
      debtAmount: bigint;
      musdToPool: bigint;
      fee: bigint;
      musdSurplus: bigint;
    };

/** The MezoRouteLeverage event in a receipt, if any. viem decodes whichever event the topic matches, so the name is checked. */
export function findTroveReceipt(logs: readonly LogLike[], network: NetworkConfig): TroveReceipt | null {
  const address = network.leverage?.address.toLowerCase();
  if (!address) return null;
  for (const log of logs) {
    if (log.address.toLowerCase() !== address) continue;
    try {
      const decoded = decodeEventLog({ abi: mezoRouteLeverageAbi, data: log.data, topics: log.topics as never });
      const a = decoded.args as Record<string, unknown>;
      switch (decoded.eventName) {
        case "Unwound":
          return { kind: "unwound", borrower: a.borrower as Address, debtRepaid: a.debtRepaid as bigint, collWithdrawn: a.collWithdrawn as bigint, btcToPool: a.btcToPool as bigint };
        case "Closed":
          return { kind: "closed", borrower: a.borrower as Address, debtRepaid: a.debtRepaid as bigint, collReturned: a.collReturned as bigint, btcToPool: a.btcToPool as bigint };
        case "Leveraged":
          return {
            kind: "leveraged",
            borrower: a.borrower as Address,
            btcAdded: a.btcAdded as bigint,
            debtIncrease: a.debtIncrease as bigint,
            musdToPool: a.musdToPool as bigint,
            fee: a.fee as bigint,
            musdSurplus: a.musdSurplus as bigint,
          };
        case "OpenedLeveraged":
          return {
            kind: "opened",
            borrower: a.borrower as Address,
            btcFromUser: a.btcFromUser as bigint,
            btcFlashed: a.btcFlashed as bigint,
            debtAmount: a.debtAmount as bigint,
            musdToPool: a.musdToPool as bigint,
            fee: a.fee as bigint,
            musdSurplus: a.musdSurplus as bigint,
          };
      }
    } catch {
      // Not one of ours.
    }
  }
  return null;
}

const musd = (value: bigint) => `${formatToken(value)} MUSD`;
const btc = (value: bigint) => `${formatToken(value)} BTC`;

/** The receipt page's rows for a Trove action, from its event. */
export function troveReceiptRows(r: TroveReceipt): { label: string; value: string }[] {
  switch (r.kind) {
    case "unwound":
      return [
        { label: "Debt repaid", value: musd(r.debtRepaid) },
        { label: "BTC withdrawn", value: btc(r.collWithdrawn) },
        { label: "BTC sold to the pool", value: btc(r.btcToPool) },
        { label: "BTC to your wallet", value: btc(r.collWithdrawn - r.btcToPool) },
      ];
    case "closed":
      return [
        { label: "Debt repaid", value: musd(r.debtRepaid) },
        { label: "BTC sold to the pool", value: btc(r.btcToPool) },
        { label: "BTC to your wallet", value: btc(r.collReturned - r.btcToPool) },
      ];
    case "leveraged":
      return [
        { label: "BTC added", value: btc(r.btcAdded) },
        { label: "MUSD borrowed", value: musd(r.debtIncrease) },
        { label: "Paid to the pool", value: musd(r.musdToPool) },
        { label: "MezoRoute fee", value: musd(r.fee) },
        { label: "MUSD to your wallet", value: musd(r.musdSurplus) },
      ];
    case "opened":
      return [
        { label: "BTC from your wallet", value: btc(r.btcFromUser) },
        { label: "BTC added from the pool", value: btc(r.btcFlashed) },
        { label: "MUSD borrowed", value: musd(r.debtAmount) },
        { label: "Paid to the pool", value: musd(r.musdToPool) },
        { label: "MezoRoute fee", value: musd(r.fee) },
        { label: "MUSD to your wallet", value: musd(r.musdSurplus) },
      ];
  }
}

export const TROVE_RECEIPT_TITLES: Record<TroveReceipt["kind"], string> = {
  unwound: "Unwind confirmed",
  closed: "Trove closed",
  leveraged: "Leverage confirmed",
  opened: "Trove opened with leverage",
};
