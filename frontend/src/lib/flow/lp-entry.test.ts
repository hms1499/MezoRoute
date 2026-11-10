import { describe, expect, it } from "vitest";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { lpAmountField, lpHeaderFigure, lpRiskLine } from "./lp-entry";
import { tokenAmountMax } from "./amount";

// U11 §6.2: the LP amount card's header figure, its amount field, and its one risk line.

const E18 = 10n ** 18n;

describe("lpHeaderFigure", () => {
  const base = { stakeOn: true, availability: "open" as const, apr: 41n * 10n ** 16n, weekly: null, poolFeeBps: 30n };

  it("shows this week's APR while staking is on and the APR is known", () => {
    const figure = lpHeaderFigure(base);
    expect(`${figure.label} ${figure.value}`).toContain("this week");
    expect(figure.value).toContain("41% APR");
  });

  it("shows this week's MEZO amount without a MEZO price", () => {
    const figure = lpHeaderFigure({ ...base, apr: null, weekly: 14n * E18 });
    expect(`${figure.label} ${figure.value}`).toContain("this week");
    expect(figure.value).toContain("14 MEZO a week");
  });

  it("falls back to the pool's swap fee when staking is off, between weeks, or without a rate", () => {
    for (const input of [
      { ...base, stakeOn: false },
      { ...base, availability: "between-weeks" as const },
      { ...base, availability: "unavailable" as const },
      { ...base, apr: null, weekly: null },
    ]) {
      expect(lpHeaderFigure(input).value).toBe("0.3% swap fee");
    }
  });

  it("never says $ or earn", () => {
    for (const figure of [lpHeaderFigure(base), lpHeaderFigure({ ...base, stakeOn: false })]) {
      expect(`${figure.label} ${figure.value}`).not.toMatch(/\$|earn/i);
    }
  });
});

describe("lpAmountField", () => {
  const btcPreview = (fillReserve: bigint | null, cap = 100n * E18) =>
    ({
      btc: { walletBtc: 10n * E18, fillReserve, gasReserve: fillReserve, maxSpendable: fillReserve === null ? 0n : 10n * E18 - fillReserve, cap },
      borrow: null,
    }) as unknown as EntryPreview;

  it("keeps the gas reserve on BTC Max (Review Focus 2)", () => {
    const field = lpAmountField({ preview: btcPreview(4n * E18), mode: "deposit", asset: "btc", walletMusd: 0n });
    expect(field.max).toBe(6n * E18);
    expect(field.max).toEqual((tokenAmountMax(10n * E18, 4n * E18) as { max: bigint }).max);
    expect(field.balance).toBe(10n * E18);
    expect(field.token).toBe("btc");
  });

  it("disables BTC Max while the gas price is unknown", () => {
    expect(lpAmountField({ preview: btcPreview(null), mode: "deposit", asset: "btc", walletMusd: 0n }).max).toBeNull();
  });

  it("caps BTC Max at the executor's cap", () => {
    expect(lpAmountField({ preview: btcPreview(E18, 2n * E18), mode: "deposit", asset: "btc", walletMusd: 0n }).max).toBe(2n * E18);
  });

  it("hides the balance and Max before a wallet connects", () => {
    const musd = { btc: null, borrow: null } as unknown as EntryPreview;
    const field = lpAmountField({ preview: musd, mode: "deposit", asset: "musd", walletMusd: 0n, connected: false });
    expect(field.balance).toBeNull();
    expect(field.max).toBeNull();
    const fromBtc = lpAmountField({ preview: btcPreview(4n * E18), mode: "deposit", asset: "btc", walletMusd: 0n, connected: false });
    expect(fromBtc.balance).toBeNull();
    expect(fromBtc.max).toBeNull();
  });

  it("offers MUSD and BTC outside Borrow & Deploy, MUSD only inside", () => {
    const musd = { btc: null, borrow: null } as unknown as EntryPreview;
    expect(lpAmountField({ preview: musd, mode: "deposit", asset: "musd", walletMusd: 5n }).tokens).toEqual(["musd", "btc"]);
    expect(lpAmountField({ preview: musd, mode: "deposit", asset: "musd", walletMusd: 5n }).max).toBe(5n);
    const borrow = { btc: null, borrow: { limit: 7n } } as unknown as EntryPreview;
    const field = lpAmountField({ preview: borrow, mode: "borrow", asset: "musd", walletMusd: 5n });
    expect(field.tokens).toBeUndefined();
    expect(field.max).toBe(7n);
    expect(field.balance).toBe(7n);
    expect(field.label).toBe("You borrow");
  });
});

describe("lpRiskLine", () => {
  it("names the main risk for each entry", () => {
    expect(lpRiskLine({ borrow: false, fromBtc: false })).toMatch(/impermanent loss/i);
    expect(lpRiskLine({ borrow: true, fromBtc: false })).toMatch(/borrowed/i);
  });
});
