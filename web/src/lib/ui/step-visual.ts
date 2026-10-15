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
