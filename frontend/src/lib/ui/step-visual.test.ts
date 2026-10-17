import { describe, expect, it } from "vitest";
import type { Step } from "@/lib/tx/stepper";
import { receiptHeader, stepVisual } from "./step-visual";

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
    expect(stepVisual(step("failed"), 1, 1)).toBe("failed");
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
