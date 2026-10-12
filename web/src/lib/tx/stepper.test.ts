import { describe, expect, it } from "vitest";
import { REJECTED } from "@/lib/errors/outcomes";
import { createStepper, hasStarted, stepperReducer, type Stepper, type StepperEvent } from "./stepper";

const HASH = "0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf";

function run<K extends string>(state: Stepper<K>, ...events: StepperEvent<K>[]): Stepper<K> {
  return events.reduce((current, event) => stepperReducer(current, event), state);
}

describe("stepper", () => {
  it("walks a permit then a send", () => {
    let state = createStepper(["permit", "enter"]);
    expect(state).toEqual({ steps: [{ kind: "permit", status: "idle" }, { kind: "enter", status: "idle" }], active: 0 });
    state = run(state, { type: "start" }, { type: "signed" });
    expect(state.active).toBe(1);
    expect(state.steps[0].status).toBe("done");
    state = run(state, { type: "start" }, { type: "submitted", hash: HASH });
    expect(state.steps[1]).toEqual({ kind: "enter", status: "submitted", hash: HASH });
    state = run(state, { type: "confirmed" });
    expect(state.active).toBe(2);
  });

  it("walks an approval through submitted and confirmed", () => {
    const state = run(createStepper(["approve", "enter"]), { type: "start" }, { type: "submitted", hash: HASH }, { type: "confirmed" });
    expect(state.steps[0]).toEqual({ kind: "approve", status: "done", hash: HASH });
    expect(state.active).toBe(1);
  });

  it("keeps a failure's error and retries only the failed step", () => {
    let state = run(createStepper(["permit", "enter"]), { type: "start" }, { type: "failed", error: REJECTED });
    expect(state.steps[0]).toEqual({ kind: "permit", status: "failed", error: REJECTED });
    state = run(state, { type: "start" });
    expect(state.steps[0]).toEqual({ kind: "permit", status: "awaiting-wallet" });
    expect(state.active).toBe(0);
  });

  it("ignores events that do not fit the active step", () => {
    const idle = createStepper(["permit", "enter"]);
    expect(run(idle, { type: "signed" })).toEqual(idle);
    expect(run(idle, { type: "confirmed" })).toEqual(idle);
    expect(run(idle, { type: "failed", error: REJECTED })).toEqual(idle);
    const signing = run(idle, { type: "start" });
    expect(run(signing, { type: "submitted", hash: HASH })).toEqual(signing); // a permit has no hash
    expect(run(signing, { type: "start" })).toEqual(signing);
  });

  it("returns to the first signature when one expires, resetting the steps after it", () => {
    const state = run(
      createStepper(["permit", "enter"]),
      { type: "start" },
      { type: "signed" },
      { type: "start" },
      { type: "signature-expired" },
    );
    expect(state).toEqual(createStepper(["permit", "enter"]));
  });

  it("ignores signature expiry without a signature step", () => {
    const state = createStepper(["approve", "enter"]);
    expect(run(state, { type: "signature-expired" })).toEqual(state);
  });

  it("replans only before anything started", () => {
    const idle = createStepper(["permit", "enter"]);
    expect(run(idle, { type: "reset", kinds: ["enter"] })).toEqual(createStepper(["enter"]));
    const started = run(idle, { type: "start" });
    expect(run(started, { type: "reset", kinds: ["enter"] })).toEqual(started);
    expect(hasStarted(idle)).toBe(false);
    expect(hasStarted(started)).toBe(true);
  });
  it("walks permit → borrow authorisation → send", () => {
    const state = run(
      createStepper(["permit", "borrow", "enter"]),
      { type: "start" },
      { type: "signed" },
      { type: "start" },
      { type: "signed" },
    );
    expect(state.active).toBe(2);
    expect(state.steps.map((step) => step.status)).toEqual(["done", "done", "idle"]);
  });

  it("resets a borrow-only plan to the borrow signature when it expires", () => {
    const state = run(createStepper(["borrow", "enter"]), { type: "start" }, { type: "signed" }, { type: "signature-expired" });
    expect(state).toEqual(createStepper(["borrow", "enter"]));
  });

  it("never takes a transaction hash for a borrow signature", () => {
    const signing = run(createStepper(["borrow", "enter"]), { type: "start" });
    expect(run(signing, { type: "submitted", hash: HASH })).toEqual(signing);
  });

  it("runs any step kinds, such as the exit flow's", () => {
    let state = createStepper<"permit" | "exit">(["permit", "exit"]);
    state = stepperReducer(state, { type: "start" });
    state = stepperReducer(state, { type: "signed" });
    expect(state.active).toBe(1);
    expect(state.steps[0]).toEqual({ kind: "permit", status: "done" });
  });
});
