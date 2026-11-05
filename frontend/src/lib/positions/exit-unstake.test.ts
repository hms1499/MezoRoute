import { describe, expect, it } from "vitest";
import { LP_CHANGED } from "@/lib/errors/outcomes";
import type { GaugeState } from "@/lib/gauge/state";
import { BlockedError } from "@/lib/tx/errors";
import { unstakeNeeded } from "./exit-unstake";
import { positionsSnapshotWith } from "./test-fixtures";

const gauge = (staked: bigint): GaugeState => ({ alive: true, rewardRate: 0n, periodFinish: 0n, totalStaked: staked, staked, earned: 0n });
const snapshot = (wallet: bigint, staked: bigint) => positionsSnapshotWith({ lpBalance: wallet, gauge: gauge(staked) });

function blocked(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof BlockedError) return error.outcome;
    throw error;
  }
  throw new Error("expected a BlockedError");
}

describe("unstakeNeeded", () => {
  it("takes out what the wallet lacks", () => {
    expect(unstakeNeeded(snapshot(0n, 100n), 25n)).toBe(25n);
    expect(unstakeNeeded(snapshot(10n, 100n), 25n)).toBe(15n);
  });

  // Wallet 0, staked 100, a 25% exit: the withdraw is mined, confirmCall times out, and "Try again" stays on screen.
  it("sends nothing on a retry after the first withdraw was mined, though the gauge still holds enough", () => {
    expect(unstakeNeeded(snapshot(25n, 75n), 25n)).toBe(0n);
  });

  it("stops with LP_CHANGED when the gauge no longer holds what is missing", () => {
    expect(blocked(() => unstakeNeeded(snapshot(0n, 10n), 25n))).toBe(LP_CHANGED);
  });

  it("asks for a retry when the gauge could not be read, rather than say the LP changed", () => {
    const failed = positionsSnapshotWith({ lpBalance: 0n, gauge: null, gaugeReadFailed: true });
    expect(blocked(() => unstakeNeeded(failed, 25n)).kind).toBe("gauge-read-failed");
  });

  it("needs no gauge read when the wallet already holds the LP", () => {
    expect(unstakeNeeded(positionsSnapshotWith({ lpBalance: 25n, gauge: null, gaugeReadFailed: true }), 25n)).toBe(0n);
  });
});
