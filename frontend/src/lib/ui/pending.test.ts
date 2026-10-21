import { describe, expect, it } from "vitest";
import { PENDING_TEXT, pendingText } from "./pending";

describe("pending button text (U10)", () => {
  it("keeps the stepper's status strings", () => {
    expect(PENDING_TEXT).toEqual({ wallet: "Check your wallet…", confirming: "Confirming…", done: "Done" });
  });

  it("names each phase, and keeps the idle label while merely busy", () => {
    expect(pendingText("wallet")).toBe("Check your wallet…");
    expect(pendingText("confirming")).toBe("Confirming…");
    expect(pendingText("done")).toBe("Done");
    expect(pendingText("busy")).toBeNull();
  });
});
