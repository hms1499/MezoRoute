import type { ReceiptState } from "@/lib/tx/receipt-state";
import type { Step } from "@/lib/tx/stepper";

export type StepVisual = "done" | "failed" | "cancelled" | "wallet" | "confirming" | "current" | "upcoming";

/**
 * How a stepper node looks: its status once it moved, else current (the step to act on) or upcoming. A step
 * the user cancelled in the wallet is not an error (U7): it reads like the current step, with a neutral note.
 */
export function stepVisual(step: Step<string>, index: number, active: number): StepVisual {
  switch (step.status) {
    case "done":
      return "done";
    case "failed":
      return step.error?.kind === "rejected" ? "cancelled" : "failed";
    case "awaiting-wallet":
      return "wallet";
    case "submitted":
      return "confirming";
    case "idle":
      return index === active ? "current" : "upcoming";
  }
}

export type StepStatus = "pending" | "done" | "failed" | "unconfirmed";

/** The receipt's place in the flow header (U3 §5.5): once there is a hash the flow is on Done, showing the transaction's state. */
export function receiptHeader(state: ReceiptState): { step: 3; stepStatus: StepStatus } {
  return { step: 3, stepStatus: state === "confirmed" ? "done" : state };
}

/** The kinds whose status became "done" between two renders of a stepper (U10: the button's brief "Done"), by kind. */
export function newlyDone<K extends string>(prev: Step<K>[], next: Step<K>[]): K[] {
  const wasDone = new Set(prev.filter((step) => step.status === "done").map((step) => step.kind));
  return next.filter((step) => step.status === "done" && !wasDone.has(step.kind)).map((step) => step.kind);
}
