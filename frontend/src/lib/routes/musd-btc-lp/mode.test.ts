import { describe, expect, it } from "vitest";
import { borrowMode } from "./mode";

describe("borrowMode", () => {
  it("offers Borrow & Deploy to a standard wallet with an open Trove", () => {
    expect(borrowMode("eoa", true)).toEqual({ disabled: false, note: null });
  });

  it("disables it without a Trove and says why next to the toggle (U7)", () => {
    expect(borrowMode("eoa", false)).toEqual({ disabled: true, note: "Borrow & Deploy needs an open Trove. Open one in the Mezo app." });
  });

  it("disables it for smart accounts, which cannot sign the authorisation", () => {
    expect(borrowMode("smart-account", true)).toEqual({ disabled: true, note: "Borrow & Deploy needs a standard wallet signature." });
  });

  it("disables it quietly while the wallet kind is unknown or loading, and waits for the Trove read", () => {
    expect(borrowMode("unknown", true)).toEqual({ disabled: true, note: null });
    expect(borrowMode(undefined, true)).toEqual({ disabled: true, note: null });
    expect(borrowMode("eoa", undefined)).toEqual({ disabled: false, note: null });
  });
});
