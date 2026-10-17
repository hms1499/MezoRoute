import { describe, expect, it } from "vitest";
import type { EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import type { HistoryEvent } from "./history";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL, ONE, positionsSnapshotWith } from "./test-fixtures";
import { positionView } from "./view";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const entry: HistoryEvent = {
  kind: "entered",
  blockNumber: 1n,
  logIndex: 0,
  event: {
    caller: ME,
    recipient: ME,
    musdBorrowed: 0n,
    musdIn: 40n * ONE,
    fee: 4n * ONE / 100n,
    musdSwapped: 20n * ONE,
    btcFromSwap: 253582349184825n,
    musdAdded: 20n * ONE,
    btcAdded: 253582349184825n,
    liquidityOut: LIVE_EXIT_LIQUIDITY,
    musdRefund: 0n,
    btcRefund: 0n,
  } satisfies EnteredEvent,
};

describe("positionView", () => {
  const snapshot = positionsSnapshotWith({ lpBalance: LIVE_EXIT_LIQUIDITY, fees: { musd: 5n * ONE, btc: ONE / 1_000n } });

  it("shows the underlying, the full-exit value, and the change against the cost basis", () => {
    const view = positionView(snapshot, [entry]);
    expect(view.lp.musd).toBe(19972003253167101669n);
    expect(view.lp.btc).toBe(253582349184825n);
    expect(view.lp.share).toBe((LIVE_EXIT_LIQUIDITY * ONE) / LIVE_EXIT_POOL.totalSupply);
    expect(view.lp.exit?.musdOut).toBe(39936013820348314126n);
    // 39.936… MUSD out against 40 MUSD in
    expect(view.lp.valueChange).toBe(39936013820348314126n - 40n * ONE);
    expect(view.empty).toBe(false);
  });

  it("values fees at the snapshot price", () => {
    const view = positionView(snapshot, null);
    expect(view.fees).toEqual({
      musd: 5n * ONE,
      btc: ONE / 1_000n,
      btcValue: (snapshot.price * (ONE / 1_000n)) / ONE,
      total: 5n * ONE + (snapshot.price * (ONE / 1_000n)) / ONE,
    });
  });

  it("has no cost or change while the history is loading or without MezoRoute entries", () => {
    expect(positionView(snapshot, null).lp).toMatchObject({ cost: null, valueChange: null });
    expect(positionView(snapshot, []).lp.valueChange).toBeNull();
  });

  it("is empty with no LP and no fees", () => {
    const view = positionView(positionsSnapshotWith({ lpBalance: 0n }), []);
    expect(view.empty).toBe(true);
    expect(view.lp.exit).toBeNull();
  });
});
