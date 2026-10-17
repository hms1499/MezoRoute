import { describe, expect, it } from "vitest";
import { asRelayFailure, RelayError } from "./errors";

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
