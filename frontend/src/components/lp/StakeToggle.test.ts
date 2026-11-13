import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GAUGE_READ_FAILED_ENTRY, stakeRowCopy } from "@/lib/gauge/copy";
import { StakeSwitch } from "./StakeToggle";

// U14 B2: staking is the overview's Staking row (its switch on the value side), not a block of its own: the block
// repeated the row and pushed Review below the fold. The copy still says swap fees go to veBTC voters.

const input = { availability: "open" as const, on: true, mezoPerWeek: 12n * 10n ** 18n, aprLabel: "12.3%", readFailed: false };

describe("stakeRowCopy", () => {
  it("says this week's MEZO, that fees go to veBTC voters, and the APR when staking is on", () => {
    const row = stakeRowCopy(input);
    expect(row?.switchable).toBe(true);
    // U21: one sentence instead of three; the rate and the APR share one "this week's rate".
    // The cost stays the person's: "while staked … instead of you", the same note as every other branch.
    expect(row?.sub).toBe("≈ 12 MEZO a week (≈ 12.3% APR) at this week's rate. While staked, swap fees go to veBTC voters instead of you.");
  });

  it("leaves the APR out while staking is off", () => {
    expect(stakeRowCopy({ ...input, on: false })?.sub).not.toContain("APR");
  });

  it("says what staking would do, in the conditional, while it is off (U14 final review)", () => {
    const sub = stakeRowCopy({ ...input, on: false })?.sub;
    expect(sub).toBe("Not staked: this deposit keeps its swap fees. Staking would earn ≈ 12 MEZO a week at this week's rate, and its swap fees would go to veBTC voters.");
  });

  it("between weeks says the rate is not set yet and keeps the switch", () => {
    const row = stakeRowCopy({ ...input, availability: "between-weeks", mezoPerWeek: null, aprLabel: null });
    expect(row?.switchable).toBe(true);
    expect(row?.sub).toContain("not set yet");
  });

  it("is absent when staking is unavailable", () => {
    expect(stakeRowCopy({ ...input, availability: "unavailable", on: false })).toBeNull();
  });

  it("says the deposit will not be staked when the gauge could not be read, with no switch", () => {
    expect(stakeRowCopy({ ...input, availability: "unavailable", on: false, readFailed: true })).toEqual({ switchable: false, sub: GAUGE_READ_FAILED_ENTRY });
  });
});

describe("StakeSwitch", () => {
  it("is a switch named Stake for MEZO", () => {
    const out = renderToStaticMarkup(createElement(StakeSwitch, { on: true, onChange: () => undefined }));
    expect(out).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*aria-label="Stake for MEZO"/);
  });
});
