import { decodeEventLog, isAddressEqual, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { formatToken } from "@/lib/format";

export type EnteredEvent = {
  caller: Address;
  recipient: Address;
  musdBorrowed: bigint;
  musdIn: bigint;
  fee: bigint;
  musdSwapped: bigint;
  btcFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidityOut: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
};

export type ExitedEvent = {
  caller: Address;
  recipient: Address;
  liquidityIn: bigint;
  musdRemoved: bigint;
  btcRemoved: bigint;
  musdFromSwap: bigint;
  musdOut: bigint;
  btcRefund: bigint;
};

export type LogLike = { address: Address; topics: readonly Hex[]; data: Hex };

/** The executor's `Entered` event from a receipt; receipts show only event values (spec FR-11). */
export function findEnteredEvent(logs: readonly LogLike[], executor: Address): EnteredEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "Entered",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      // viem decodes whichever ABI event the topic matches; `eventName` only narrows the type.
      if (decoded.eventName === "Entered") return decoded.args as EnteredEvent;
    } catch {
      // Another executor event (e.g. Exited); keep looking.
    }
  }
  return null;
}

/** The receipt's rows, from the Entered event only (FR-11); realised values, six decimals. */
export function enteredRows(event: EnteredEvent): { label: string; value: string }[] {
  const musd = (value: bigint) => `${formatToken(value)} MUSD`;
  const btc = (value: bigint) => `${formatToken(value)} BTC`;
  return [
    ...(event.musdBorrowed > 0n ? [{ label: "MUSD borrowed", value: musd(event.musdBorrowed) }] : []),
    { label: "MUSD in", value: musd(event.musdIn) },
    { label: "MezoRoute fee", value: musd(event.fee) },
    { label: "MUSD swapped", value: musd(event.musdSwapped) },
    { label: "BTC from the swap", value: btc(event.btcFromSwap) },
    { label: "MUSD deposited", value: musd(event.musdAdded) },
    { label: "BTC deposited", value: btc(event.btcAdded) },
    { label: "LP received", value: `${formatToken(event.liquidityOut)} LP` },
    { label: "MUSD returned", value: musd(event.musdRefund) },
    { label: "BTC returned", value: btc(event.btcRefund) },
  ];
}

/** The executor's `Exited` event from a receipt (FR-11: receipts show event values only). */
export function findExitedEvent(logs: readonly LogLike[], executor: Address): ExitedEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "Exited",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      // viem decodes whichever ABI event the topic matches; `eventName` only narrows the type.
      if (decoded.eventName === "Exited") return decoded.args as ExitedEvent;
    } catch {
      // Another executor event (e.g. Entered); keep looking.
    }
  }
  return null;
}

/** The exit receipt's rows: realised values from the event, six decimals. */
export function exitedRows(event: ExitedEvent): { label: string; value: string }[] {
  const musd = (value: bigint) => `${formatToken(value)} MUSD`;
  const btc = (value: bigint) => `${formatToken(value)} BTC`;
  return [
    { label: "LP exited", value: `${formatToken(event.liquidityIn)} LP` },
    { label: "MUSD from the pool", value: musd(event.musdRemoved) },
    { label: "BTC from the pool", value: btc(event.btcRemoved) },
    { label: "MUSD from selling the BTC", value: musd(event.musdFromSwap) },
    { label: "MUSD received", value: musd(event.musdOut) },
    { label: "BTC returned", value: btc(event.btcRefund) },
  ];
}
