import type { NetworkConfig } from "@/lib/config/networks";
import { findGaugeReceipt, type GaugeReceipt } from "@/lib/gauge/actions";
import { findClaimEvent } from "@/lib/positions/claim";
import type { Fees } from "@/lib/positions/fees";
import {
  findEnteredEvent,
  findEnteredFromBtcEvent,
  findExitedEvent,
  findStakedEvent,
  type EnteredEvent,
  type EnteredFromBtcEvent,
  type ExitedEvent,
  type LogLike,
  type StakedEvent,
} from "@/lib/routes/musd-btc-lp/receipt";
import { findSpReceipt, type SpReceipt } from "@/lib/stability-pool/receipt";

export type ReceiptKind =
  | { kind: "entered"; event: EnteredEvent; staked: StakedEvent | null }
  | { kind: "enteredBtc"; event: EnteredFromBtcEvent; staked: StakedEvent | null }
  | { kind: "exited"; event: ExitedEvent }
  | { kind: "claim"; fees: Fees }
  | { kind: "gauge"; gauge: GaugeReceipt }
  | { kind: SpReceipt["kind"]; sp: SpReceipt }
  | null;

/** What a confirmed transaction did, from its logs: an entry, an exit, a fee claim, a gauge action, or a Stability Pool action. */
export function receiptKind(logs: readonly LogLike[], network: NetworkConfig): ReceiptKind {
  // Legacy executors too: a receipt link from before an upgrade still names what it did.
  const executors = [...(network.executor ? [network.executor.address] : []), ...network.legacyExecutors.map((item) => item.address)];
  for (const executor of executors) {
    const entered = findEnteredEvent(logs, executor);
    if (entered) return { kind: "entered", event: entered, staked: findStakedEvent(logs, executor) };
    const enteredBtc = findEnteredFromBtcEvent(logs, executor);
    if (enteredBtc) return { kind: "enteredBtc", event: enteredBtc, staked: findStakedEvent(logs, executor) };
    const exited = findExitedEvent(logs, executor);
    if (exited) return { kind: "exited", event: exited };
  }
  const fees = findClaimEvent(logs, network);
  if (fees) return { kind: "claim", fees };
  const gauge = network.gauge ? findGaugeReceipt(logs, network.gauge.address) : null;
  if (gauge) return { kind: "gauge", gauge };
  const sp = findSpReceipt(logs, network);
  return sp ? { kind: sp.kind, sp } : null;
}
