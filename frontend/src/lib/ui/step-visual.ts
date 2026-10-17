import type { ReceiptState } from "@/lib/tx/receipt-state";
import type { Step } from "@/lib/tx/stepper";

export type StepVisual = "done" | "failed" | "wallet" | "confirming" | "current" | "upcoming";

/** How a stepper node looks: its status once it moved, else current (the step to act on) or upcoming. */
export function stepVisual(step: Step<string>, index: number, active: number): StepVisual {
  switch (step.status) {
    case "done":
      return "done";
    case "failed":
      return "failed";
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
