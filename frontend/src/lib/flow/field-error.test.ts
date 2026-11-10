import { describe, expect, it } from "vitest";
import type { Outcome } from "@/lib/errors/types";
import { PRICE_IMPACT_WARN } from "@/lib/routes/musd-btc-lp/gate";
import { isFieldBlock, lpFieldError, spFieldError, troveFieldError } from "./field-error";

// U14 B3: a block the typed amount causes is said at the field (aria-invalid, the message under it), not 600 px
// below; blocks about the wallet, the network, or the system stay in the page's notice.

const outcome = (message: string): Outcome => ({ kind: "insufficient-balance", message, recovery: [] });

describe("lpFieldError", () => {
  it.each(["insufficient-balance", "above-cap", "too-small", "above-headroom"] as const)("puts %s at the field with its message", (reason) => {
    expect(lpFieldError({ reason, outcome: outcome(`why ${reason}`) })).toBe(`why ${reason}`);
  });

  it("names the price-impact limit at the field", () => {
    expect(lpFieldError({ reason: "price-impact", outcome: outcome("too much") })).toBe("Price impact above 5%: try a smaller amount.");
  });

  it("leaves other blocks to the notice", () => {
    expect(lpFieldError({ reason: "wrong-network", outcome: outcome("switch") })).toBeNull();
    expect(lpFieldError(null)).toBeNull();
    expect(lpFieldError({ reason: "zero", outcome: null })).toBeNull();
  });
});

describe("spFieldError", () => {
  it("puts the balance and minimum blocks at the field", () => {
    expect(spFieldError({ reason: "insufficient-balance", outcome: outcome("short") })).toBe("short");
    expect(spFieldError({ reason: "too-small", outcome: outcome("small") })).toBe("small");
    expect(spFieldError({ reason: "wrong-network", outcome: outcome("switch") })).toBeNull();
  });
});

describe("troveFieldError", () => {
  const both = { btc: true, cr: true };

  it("puts a BTC shortfall on the BTC field and the size limits on the ratio field", () => {
    expect(troveFieldError({ reason: "insufficient-btc", outcome: outcome("no btc") }, both)).toEqual({ field: "btc", message: "no btc" });
    for (const reason of ["above-cap", "capacity", "oracle-bound", "below-min-debt"] as const) {
      expect(troveFieldError({ reason, outcome: outcome(reason) }, both)).toEqual({ field: "cr", message: reason });
    }
    expect(troveFieldError({ reason: "recovery-mode", outcome: outcome("rm") }, both)).toBeNull();
  });

  it("leaves a block to the page when its field is not on the page (Close has no field)", () => {
    expect(troveFieldError({ reason: "above-cap", outcome: outcome("cap") }, { btc: false, cr: false })).toBeNull();
    expect(troveFieldError({ reason: "insufficient-btc", outcome: outcome("no btc") }, { btc: false, cr: true })).toBeNull();
  });
});

describe("isFieldBlock", () => {
  it("tells the notice which reasons the field already says", () => {
    expect(isFieldBlock("insufficient-balance")).toBe(true);
    expect(isFieldBlock("price-impact")).toBe(true);
    expect(isFieldBlock("insufficient-btc")).toBe(true);
    expect(isFieldBlock("wrong-network")).toBe(false);
    expect(isFieldBlock("below-min-debt")).toBe(false); // it keeps its page notice too (Close instead)
  });
});

describe("PRICE_IMPACT_WARN", () => {
  it("is 1%", () => {
    expect(PRICE_IMPACT_WARN).toBe(10n ** 16n);
  });
});
