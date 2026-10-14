import { describe, expect, it } from "vitest";
import { FIXTURE_PRICE, ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { WAD } from "@/lib/math";
import { spView } from "./position";
import { spSnapshotWith } from "./test-fixtures";

describe("spView", () => {
  const snapshot = spSnapshotWith({
    dashboard: snapshotWith({ sp: { deposit: 40n * ONE, btcGain: 1_000_000_000_000_000n } }),
    initialDeposit: 50n * ONE,
  });

  it("values the compounded deposit plus the pending gain at the price feed", () => {
    const view = spView(snapshot, null);
    const gainValue = (1_000_000_000_000_000n * FIXTURE_PRICE) / WAD;
    expect(view).toMatchObject({ deposit: 40n * ONE, gain: 1_000_000_000_000_000n, gainValue, value: 40n * ONE + gainValue, empty: false, cost: null });
  });

  it("adds the cost rows once the history is in: value change and everything absorbed", () => {
    const view = spView(snapshot, { basis: 60n * ONE, gainsClaimed: 2n, lossRealised: 5n * ONE, lastDeposit: 50n * ONE });
    expect(view.cost).toEqual({
      basis: 60n * ONE,
      valueChange: view.value - 60n * ONE,
      gainsClaimed: 2n,
      absorbed: 5n * ONE + 10n * ONE, // realised before + pending since the last action (50 − 40)
    });
  });

  it("is empty without an initial deposit", () => {
    expect(spView(spSnapshotWith(), null).empty).toBe(true);
  });
});
