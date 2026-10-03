import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { asRelayFailure, classifySendError, RelayError, SmartAccountCallFailedError } from "./errors";

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

  // OrangeKit's Xverse provider throws serializeError(new EIP1193Error(4001)): a plain object, not an Error.
  it("maps OrangeKit's plain-object Xverse rejection (code 4001)", () => {
    expect(classifySendError({ code: 4001, message: "The user rejected the request." })).toEqual({
      kind: "rejected",
      message: "Transaction was not signed.",
    });
  });

  it("treats EIP-1193 code 4001 as a rejection whatever the wording", () => {
    expect(classifySendError({ code: 4001, message: "Denied" }).kind).toBe("rejected");
  });

  it("reads the message of a plain error object", () => {
    expect(classifySendError({ code: -32000, message: "boom" })).toEqual({ kind: "unknown", message: "boom" });
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

// Failures OrangeKit raises before any hash exists when Mezo's relayer misbehaves.
describe("asRelayFailure", () => {
  const nonJsonBody = new SyntaxError("Unexpected token '<', \"<!doctype \"... is not valid JSON");
  const networkDown = new TypeError("Failed to fetch");
  const deployRelayerZeroHash = new Error(
    "Invalid parameters were provided to the RPC method. Details: hex string has length 0, want 64 for common.Hash",
  );

  it.each([
    ["a non-JSON relayer response", nonJsonBody],
    ["a network or CORS failure", networkDown],
    ["the deploy relayer's empty hash", deployRelayerZeroHash],
  ])("reports %s from a Bitcoin wallet as a relay error", (_name, error) => {
    const wrapped = asRelayFailure(error, "orangekit");
    expect(wrapped).toBeInstanceOf(RelayError);
    expect(classifySendError(wrapped).kind).toBe("relay");
  });

  it("leaves rejections, missing gas, and reverts from a Bitcoin wallet alone", () => {
    const rejection = { code: 4001, message: "The user rejected the request." };
    const noGas = new Error("Not enough native token balance to cover transaction gas.");
    const revert = new Error("Execution reverted with reason: InvalidSwapAmount()");
    for (const error of [rejection, noGas, revert]) expect(asRelayFailure(error, "orangekit")).toBe(error);
  });

  it("leaves EVM wallet errors alone", () => {
    expect(asRelayFailure(networkDown, "injected")).toBe(networkDown);
    expect(asRelayFailure(networkDown, undefined)).toBe(networkDown);
  });
});
