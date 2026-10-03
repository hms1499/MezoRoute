import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { classifySendError, RelayError, SmartAccountCallFailedError } from "./errors";

describe("classifySendError", () => {
  it("maps relay failures", () => {
    expect(classifySendError(new RelayError("no hash")).kind).toBe("relay");
  });

  it("maps a rejected EVM signature (spec 13)", () => {
    expect(classifySendError(new UserRejectedRequestError(new Error("User rejected the request.")))).toEqual({
      kind: "rejected",
      message: "Transaction was not signed.",
    });
  });

  it("finds a Bitcoin-wallet rejection in the cause chain", () => {
    const error = new Error("Failed to send", { cause: new Error("User rejected the request.") });
    expect(classifySendError(error).kind).toBe("rejected");
  });

  it("maps OrangeKit's empty-Safe error to needs-gas (spec 13)", () => {
    const error = new Error(
      "Not enough native token balance to cover transaction gas. Required: 146000 sats. Current balance: 0 sats.",
    );
    expect(classifySendError(error)).toEqual({
      kind: "needs-gas",
      message: "You need test BTC to submit transactions.",
    });
  });

  it("maps a reverted smart-account call", () => {
    expect(classifySendError(new SmartAccountCallFailedError("0xabc")).kind).toBe("reverted");
  });

  it("falls back to the error message", () => {
    expect(classifySendError(new Error("boom"))).toEqual({ kind: "unknown", message: "boom" });
    expect(classifySendError("weird")).toEqual({ kind: "unknown", message: "weird" });
  });
});
