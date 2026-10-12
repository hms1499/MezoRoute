import type { Hash } from "viem";
import type { DecodedError } from "@/lib/errors/types";
import type { StepKind } from "@/lib/routes/musd-btc-lp/steps";

export type StepStatus = "idle" | "awaiting-wallet" | "submitted" | "done" | "failed";
export type Step = { kind: StepKind; status: StepStatus; hash?: Hash; error?: DecodedError };
/** `active` is the index of the step the user acts on next; it equals `steps.length` when all are done. */
export type Stepper = { steps: Step[]; active: number };

export type StepperEvent =
  | { type: "start" }
  | { type: "signed" }
  | { type: "submitted"; hash: Hash }
  | { type: "confirmed" }
  | { type: "failed"; error: DecodedError }
  | { type: "permit-expired" }
  | { type: "reset"; kinds: StepKind[] };

export function createStepper(kinds: StepKind[]): Stepper {
  return { steps: kinds.map((kind) => ({ kind, status: "idle" })), active: 0 };
}

export function hasStarted(state: Stepper): boolean {
  return state.steps.some((step) => step.status !== "idle");
}

/** The confirm page's stepper (spec §9 screen 3a); events that do not fit the active step are ignored. */
export function stepperReducer(state: Stepper, event: StepperEvent): Stepper {
  const step = state.steps[state.active];
  const replace = (next: Step, advance = false): Stepper => ({
    steps: state.steps.map((current, index) => (index === state.active ? next : current)),
    active: advance ? state.active + 1 : state.active,
  });

  switch (event.type) {
    case "reset":
      return hasStarted(state) ? state : createStepper(event.kinds);
    case "permit-expired": {
      const permit = state.steps.findIndex((current) => current.kind === "permit");
      if (permit === -1) return state;
      return {
        steps: state.steps.map((current, index) => (index >= permit ? { kind: current.kind, status: "idle" } : current)),
        active: permit,
      };
    }
    case "start":
      return step && (step.status === "idle" || step.status === "failed")
        ? replace({ kind: step.kind, status: "awaiting-wallet" })
        : state;
    case "signed":
      return step?.kind === "permit" && step.status === "awaiting-wallet" ? replace({ ...step, status: "done" }, true) : state;
    case "submitted":
      return step && step.kind !== "permit" && step.status === "awaiting-wallet"
        ? replace({ ...step, status: "submitted", hash: event.hash })
        : state;
    case "confirmed":
      return step?.status === "submitted" ? replace({ ...step, status: "done" }, true) : state;
    case "failed":
      return step && (step.status === "awaiting-wallet" || step.status === "submitted")
        ? replace({ ...step, status: "failed", error: event.error })
        : state;
  }
}
