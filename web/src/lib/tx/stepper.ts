import type { Hash } from "viem";
import type { DecodedError } from "@/lib/errors/types";
import type { StepKind } from "@/lib/routes/musd-btc-lp/steps";

export type StepStatus = "idle" | "awaiting-wallet" | "submitted" | "done" | "failed";
export type Step<K extends string = StepKind> = { kind: K; status: StepStatus; hash?: Hash; error?: DecodedError };
/** `active` is the index of the step the user acts on next; it equals `steps.length` when all are done. */
export type Stepper<K extends string = StepKind> = { steps: Step<K>[]; active: number };

export type StepperEvent<K extends string = StepKind> =
  | { type: "start" }
  | { type: "signed" }
  | { type: "submitted"; hash: Hash }
  | { type: "confirmed" }
  | { type: "failed"; error: DecodedError }
  | { type: "signature-expired" }
  | { type: "reset"; kinds: K[] }
  /** "Start over": a fresh stepper even after a step started (the flow drops its pinned values too). */
  | { type: "restart"; kinds: K[] };

export function createStepper<K extends string = StepKind>(kinds: K[]): Stepper<K> {
  return { steps: kinds.map((kind) => ({ kind, status: "idle" })), active: 0 };
}

export function hasStarted(state: Stepper<string>): boolean {
  return state.steps.some((step) => step.status !== "idle");
}

/** Steps the user signs without a transaction. */
function isSignature(kind: string): boolean {
  return kind === "permit" || kind === "borrow";
}

/** The entry and exit steppers (spec §9 screens 3a, 6a); events that do not fit the active step are ignored. */
export function stepperReducer<K extends string = StepKind>(state: Stepper<K>, event: StepperEvent<K>): Stepper<K> {
  const step = state.steps[state.active];
  const replace = (next: Step<K>, advance = false): Stepper<K> => ({
    steps: state.steps.map((current, index) => (index === state.active ? next : current)),
    active: advance ? state.active + 1 : state.active,
  });

  switch (event.type) {
    case "reset":
      return hasStarted(state) ? state : createStepper(event.kinds);
    case "restart":
      return createStepper(event.kinds);
    case "signature-expired": {
      const first = state.steps.findIndex((current) => isSignature(current.kind));
      if (first === -1) return state;
      return {
        steps: state.steps.map((current, index) => (index >= first ? { kind: current.kind, status: "idle" } : current)),
        active: first,
      };
    }
    case "start":
      return step && (step.status === "idle" || step.status === "failed")
        ? replace({ kind: step.kind, status: "awaiting-wallet" })
        : state;
    case "signed":
      return step && isSignature(step.kind) && step.status === "awaiting-wallet" ? replace({ ...step, status: "done" }, true) : state;
    case "submitted":
      return step && !isSignature(step.kind) && step.status === "awaiting-wallet"
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
