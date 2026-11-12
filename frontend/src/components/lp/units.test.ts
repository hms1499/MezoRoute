import { describe, expect, it } from "vitest";
import { lpShort, musdShort, signedMusd } from "./units";

const ONE = 10n ** 18n;

describe("signedMusd", () => {
  it("prefixes a gain with + and a loss with a true minus sign", () => {
    expect(signedMusd(3n * ONE / 2n)).toBe("+1.5 MUSD");
    expect(signedMusd(-(6n * ONE) / 100n)).toBe("−0.06 MUSD");
    expect(signedMusd(0n)).toBe("+0 MUSD");
  });
});

describe("planner precision", () => {
  it("truncates MUSD to 2 and LP to 4", () => {
    expect(musdShort(961_077_123_000_000_000_000n)).toBe("961.07 MUSD");
    expect(lpShort(1_782_558_900_000_000_000n)).toBe("1.7825 LP");
  });
  it("never shows a non-zero amount as 0", () => {
    expect(musdShort(10n ** 15n)).toBe("<0.01 MUSD");
  });
});
