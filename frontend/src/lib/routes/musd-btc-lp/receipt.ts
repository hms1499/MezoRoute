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

/** V2's `EnteredFromBtc` event: an entry that took BTC. */
export type EnteredFromBtcEvent = {
  caller: Address;
  recipient: Address;
  btcIn: bigint;
  fee: bigint;
  btcToSwap: bigint;
  musdFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidityOut: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
};

/** The executor's `Staked` event: the LP it staked in the gauge for the recipient (V2). */
export type StakedEvent = { recipient: Address; liquidity: bigint };

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

/** The executor's `EnteredFromBtc` event from a receipt. */
export function findEnteredFromBtcEvent(logs: readonly LogLike[], executor: Address): EnteredFromBtcEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "EnteredFromBtc",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      // viem decodes whichever ABI event the topic matches; `eventName` only narrows the type.
      if (decoded.eventName === "EnteredFromBtc") return decoded.args as EnteredFromBtcEvent;
    } catch {
      // Another executor event; keep looking.
    }
  }
  return null;
}

/** The executor's `Staked` event from a receipt, null when the entry did not stake. */
export function findStakedEvent(logs: readonly LogLike[], executor: Address): StakedEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "Staked",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      // viem decodes whichever ABI event the topic matches; `eventName` only narrows the type.
      if (decoded.eventName === "Staked") return decoded.args as StakedEvent;
    } catch {
      // Another executor event; keep looking.
    }
  }
  return null;
}

/** The receipt's rows, from the Entered and Staked events only (FR-11); realised values, six decimals. */
export function enteredRows(event: EnteredEvent, staked: StakedEvent | null = null): { label: string; value: string }[] {
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
    ...(staked
      ? [
          { label: "Staked in the gauge", value: `${formatToken(staked.liquidity)} LP` },
          { label: "LP left in your wallet", value: `${formatToken(event.liquidityOut - staked.liquidity)} LP` },
        ]
      : []),
    { label: "MUSD returned", value: musd(event.musdRefund) },
    { label: "BTC returned", value: btc(event.btcRefund) },
  ];
}

/**
 * The BTC entry receipt's rows: realised values from the event. BTC shows eight decimals (a BTC entry is a
 * fraction of a coin, so six would round most of it away), MUSD and LP six.
 */
export function enteredFromBtcRows(event: EnteredFromBtcEvent, staked: StakedEvent | null = null): { label: string; value: string }[] {
  const musd = (value: bigint) => `${formatToken(value)} MUSD`;
  const btc = (value: bigint) => `${formatToken(value, 18, 8)} BTC`;
  return [
    { label: "BTC in", value: btc(event.btcIn) },
    { label: "MezoRoute fee", value: btc(event.fee) },
    { label: "BTC swapped", value: btc(event.btcToSwap) },
    { label: "MUSD from the swap", value: musd(event.musdFromSwap) },
    { label: "MUSD deposited", value: musd(event.musdAdded) },
    { label: "BTC deposited", value: btc(event.btcAdded) },
    { label: "LP received", value: `${formatToken(event.liquidityOut)} LP` },
    ...(staked
      ? [
          { label: "Staked in the gauge", value: `${formatToken(staked.liquidity)} LP` },
          { label: "LP left in your wallet", value: `${formatToken(event.liquidityOut - staked.liquidity)} LP` },
        ]
      : []),
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
