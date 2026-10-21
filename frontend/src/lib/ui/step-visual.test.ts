import { describe, expect, it } from "vitest";
import { REJECTED, RELAY } from "@/lib/errors/outcomes";
import type { Step } from "@/lib/tx/stepper";
import { newlyDone, receiptHeader, stepVisual } from "./step-visual";

const step = (status: Step<string>["status"]): Step<string> => ({ kind: "enter", status });

describe("stepVisual", () => {
  it("shows the active idle step as current and later idle steps as upcoming", () => {
    expect(stepVisual(step("idle"), 0, 0)).toBe("current");
    expect(stepVisual(step("idle"), 1, 0)).toBe("upcoming");
  });

  it("follows the step status once it moved", () => {
    expect(stepVisual(step("awaiting-wallet"), 0, 0)).toBe("wallet");
    expect(stepVisual(step("submitted"), 0, 0)).toBe("confirming");
    expect(stepVisual(step("done"), 0, 1)).toBe("done");
    expect(stepVisual({ ...step("failed"), error: RELAY }, 1, 1)).toBe("failed");
  });

  it("shows a step the user cancelled in the wallet as cancelled, not failed", () => {
    expect(stepVisual({ ...step("failed"), error: REJECTED }, 0, 0)).toBe("cancelled");
  });
});

describe("receiptHeader", () => {
  it("puts the flow on Done once a hash exists, with the transaction's state on that step", () => {
    expect(receiptHeader("pending")).toEqual({ step: 3, stepStatus: "pending" });
    expect(receiptHeader("confirmed")).toEqual({ step: 3, stepStatus: "done" });
    expect(receiptHeader("failed")).toEqual({ step: 3, stepStatus: "failed" });
    expect(receiptHeader("unconfirmed")).toEqual({ step: 3, stepStatus: "unconfirmed" });
  });
});

describe("newlyDone (U10)", () => {
  const at = (kind: string, status: Step<string>["status"]): Step<string> => ({ kind, status });
  it("names the steps that just finished", () => {
    expect(newlyDone([at("approve", "submitted"), at("enter", "idle")], [at("approve", "done"), at("enter", "idle")])).toEqual(["approve"]);
    expect(newlyDone([at("permit", "awaiting-wallet")], [at("permit", "done")])).toEqual(["permit"]);
  });

  it("ignores unchanged steps and steps that were already done", () => {
    const steps = [at("approve", "done"), at("enter", "awaiting-wallet")];
    expect(newlyDone(steps, steps)).toEqual([]);
    expect(newlyDone(steps, [at("approve", "done"), at("enter", "submitted")])).toEqual([]);
  });
});

describe("newlyDone across a change of shape (U10 minor)", () => {
  const at = (kind: string, status: Step<string>["status"]): Step<string> => ({ kind, status });
  it("matches steps by kind, so a step added in front never makes a finished step flash again", () => {
    expect(newlyDone([at("approve", "done"), at("enter", "idle")], [at("permit", "idle"), at("approve", "done"), at("enter", "idle")])).toEqual([]);
    expect(newlyDone([at("enter", "submitted")], [at("permit", "done"), at("enter", "done")])).toEqual(["permit", "enter"]);
  });
});
