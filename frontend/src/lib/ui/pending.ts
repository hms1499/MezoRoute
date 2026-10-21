// U10 (spec §3): one pending presentation for every wallet action. A button keeps its label as its accessible name;
// the status beside it is visual, and the stepper's live region (same strings) is what assistive tech hears.

/** A button's pending phase; `busy` waits without a status of its own (a network switch). */
export type Pending = "wallet" | "confirming" | "done" | "busy";

export const PENDING_TEXT: Record<Exclude<Pending, "busy">, string> = {
  wallet: "Check your wallet…",
  confirming: "Confirming…",
  done: "Done",
};

/** The status a pending button shows, or null when it keeps its own label. */
export function pendingText(pending: Pending): string | null {
  return pending === "busy" ? null : PENDING_TEXT[pending];
}
