import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { defaultCompareAmount } from "./default-amount";

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
