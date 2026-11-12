import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { compareStart, defaultCompareAmount, showsOverBalance } from "./default-amount";

const TESTNET_CAP = 1_000_000n * WAD;

describe("defaultCompareAmount", () => {
  it("uses a 1,000 MUSD example when the wallet holds less than 1 MUSD", () => {
    expect(defaultCompareAmount(0n, TESTNET_CAP)).toEqual({ text: "1000", example: true });
    expect(defaultCompareAmount(WAD / 2n, TESTNET_CAP)).toEqual({ text: "1000", example: true });
  });

  it("uses the wallet balance, floored to whole MUSD", () => {
    expect(defaultCompareAmount(2_427n * WAD + WAD / 3n, TESTNET_CAP)).toEqual({ text: "2427", example: false });
  });

  it("never exceeds the network's entry cap", () => {
    expect(defaultCompareAmount(5_000n * WAD, 1_000n * WAD)).toEqual({ text: "1000", example: false });
  });
});

// U17 §6: /compare/ works without a wallet and takes its starting amount from the URL.
describe("compareStart", () => {
  const CAP = 1_000n * WAD;

  it("starts from a valid amount in the URL, never as an example", () => {
    expect(compareStart("250.5", 0n, CAP)).toEqual({ text: "250.5", example: false });
    expect(compareStart(" 40 ", 0n, CAP)).toEqual({ text: "40", example: false });
  });

  it.each([null, "", "abc", "-5", "0", "1e5", "1,000"])("falls back for %j", (param) => {
    expect(compareStart(param, 0n, CAP)).toEqual({ text: "1000", example: true });
    expect(compareStart(param, 40n * WAD, CAP)).toEqual({ text: "40", example: false });
  });
});

describe("showsOverBalance", () => {
  it("never blames a wallet that is not connected", () => {
    expect(showsOverBalance({ connected: false, overBalance: true, example: false })).toBe(false);
  });

  it("says so for a connected wallet's own amount, not for the example", () => {
    expect(showsOverBalance({ connected: true, overBalance: true, example: false })).toBe(true);
    expect(showsOverBalance({ connected: true, overBalance: true, example: true })).toBe(false);
    expect(showsOverBalance({ connected: true, overBalance: false, example: false })).toBe(false);
  });
});
