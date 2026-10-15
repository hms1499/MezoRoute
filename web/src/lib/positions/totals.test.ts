import { describe, expect, it } from "vitest";
import type { SpView } from "@/lib/stability-pool/position";
import { positionTotals } from "./totals";
import type { PositionView } from "./view";

const ONE = 10n ** 18n;
const view = {
  lp: { balance: 1n, share: 0n, musd: 5n * ONE, btc: 60_000_000_000_000n, btcValue: 5n * ONE, value: 10n * ONE, exit: null, cost: null, valueChange: null },
  fees: { musd: ONE / 100n, btc: 1_000_000_000n, btcValue: ONE / 100n, total: ONE / 50n },
  empty: false,
} satisfies PositionView;
const pool = { deposit: 20n * ONE, gain: 2_000_000_000_000n, gainValue: ONE / 5n, value: 20n * ONE + ONE / 5n, empty: false, cost: null } satisfies SpView;

describe("positionTotals", () => {
  it("adds LP value, unclaimed fees, and the Stability Pool; BTC from all three", () => {
    expect(positionTotals(view, pool)).toEqual({
      value: 10n * ONE + ONE / 50n + 20n * ONE + ONE / 5n,
      btc: 60_000_000_000_000n + 1_000_000_000n + 2_000_000_000_000n,
    });
  });

  it("ignores an empty or missing Stability Pool position", () => {
    expect(positionTotals(view, null)).toEqual({ value: 10n * ONE + ONE / 50n, btc: 60_001_000_000_000n });
    expect(positionTotals(view, { ...pool, empty: true })).toEqual(positionTotals(view, null));
  });
});
