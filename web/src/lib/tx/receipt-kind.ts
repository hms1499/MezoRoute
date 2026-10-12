import type { NetworkConfig } from "@/lib/config/networks";
import { findClaimEvent } from "@/lib/positions/claim";
import type { Fees } from "@/lib/positions/fees";
import {
  findEnteredEvent,
  findExitedEvent,
  type EnteredEvent,
  type ExitedEvent,
  type LogLike,
} from "@/lib/routes/musd-btc-lp/receipt";

export type ReceiptKind =
  | { kind: "entered"; event: EnteredEvent }
  | { kind: "exited"; event: ExitedEvent }
  | { kind: "claim"; fees: Fees }
  | null;

/** What a confirmed transaction did, from its logs: an entry, an exit, or a fee claim. */
export function receiptKind(logs: readonly LogLike[], network: NetworkConfig): ReceiptKind {
  const executor = network.executor?.address;
  const entered = executor ? findEnteredEvent(logs, executor) : null;
  if (entered) return { kind: "entered", event: entered };
  const exited = executor ? findExitedEvent(logs, executor) : null;
  if (exited) return { kind: "exited", event: exited };
  const fees = findClaimEvent(logs, network);
  return fees ? { kind: "claim", fees } : null;
}
