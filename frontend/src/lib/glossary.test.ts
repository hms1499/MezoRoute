import { describe, expect, it } from "vitest";
import { snapshotWith } from "@/lib/dashboard/test-fixtures";
import { formatPercent } from "@/lib/format";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { GLOSSARY, type TermId } from "./glossary";

const TERMS: TermId[] = [
  "trove",
  "musd",
  "stabilityPool",
  "collateralRatio",
  "mcr",
  "safetyFloor",
  "liquidationPrice",
  "btcGain",
  "borrowAndDeploy",
  "permit",
];

describe("GLOSSARY", () => {
  it("defines exactly the Mezo terms approved for U8, and no general DeFi terms", () => {
    expect(Object.keys(GLOSSARY).sort()).toEqual([...TERMS].sort());
  });

  it("keeps every definition to one short sentence", () => {
    for (const term of TERMS) {
      const text = GLOSSARY[term];
      expect(text, term).toMatch(/^[A-Z].*\.$/);
      expect(text.slice(0, -1), term).not.toMatch(/[.!?](\s|$)/);
      expect(text.length, term).toBeLessThanOrEqual(110);
    }
  });

  it("quotes the same 110% and 160% the app enforces", () => {
    expect(GLOSSARY.mcr).toContain(formatPercent(snapshotWith({}).protocol.mcr, 0));
    expect(GLOSSARY.liquidationPrice).toContain(formatPercent(snapshotWith({}).protocol.mcr, 0));
    expect(GLOSSARY.safetyFloor).toContain(formatPercent(CR_SAFETY_FLOOR, 0));
  });
});
