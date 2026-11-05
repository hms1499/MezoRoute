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
  const executor = network.executor?.address;
  const entered = executor ? findEnteredEvent(logs, executor) : null;
  if (entered) return { kind: "entered", event: entered, staked: executor ? findStakedEvent(logs, executor) : null };
  const enteredBtc = executor ? findEnteredFromBtcEvent(logs, executor) : null;
  if (enteredBtc) return { kind: "enteredBtc", event: enteredBtc, staked: executor ? findStakedEvent(logs, executor) : null };
  const exited = executor ? findExitedEvent(logs, executor) : null;
  if (exited) return { kind: "exited", event: exited };
  const fees = findClaimEvent(logs, network);
  if (fees) return { kind: "claim", fees };
  const gauge = network.gauge ? findGaugeReceipt(logs, network.gauge.address) : null;
  if (gauge) return { kind: "gauge", gauge };
  const sp = findSpReceipt(logs, network);
  return sp ? { kind: sp.kind, sp } : null;
}
