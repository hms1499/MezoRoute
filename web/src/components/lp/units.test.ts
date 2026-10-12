import { describe, expect, it } from "vitest";
import { signedMusd } from "./units";

const ONE = 10n ** 18n;

describe("signedMusd", () => {
  it("prefixes a gain with + and a loss with a true minus sign", () => {
    expect(signedMusd(3n * ONE / 2n)).toBe("+1.5 MUSD");
    expect(signedMusd(-(6n * ONE) / 100n)).toBe("−0.06 MUSD");
    expect(signedMusd(0n)).toBe("+0 MUSD");
  });
});
