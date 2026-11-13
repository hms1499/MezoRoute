import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { networks } from "@/lib/config/networks";
import type { QueueEntry } from "@/lib/leverage/queue";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { HARNESS_POOL, ONE } from "@/lib/leverage/test-fixtures";
import type { TroveState } from "@/lib/leverage/trove-math";
import { trovePageState, troveCrPlot } from "./page";
import { riskLines } from "./risk";

const ME = "0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56" as Address;
const OTHER = "0x0000000000000000000000000000000000000001" as Address;
const MCR = (11n * ONE) / 10n;
const PRICE = 69_079_566_890_000_000_000_000n;
// The testnet QA Trove on 13 Nov 2026.
const LIVE: TroveState = {
  coll: 99_499_760_615_756_376n,
  principal: 2_419_006_790_000_000_000_000n,
  interest: 9_821_768_641_358_278_199n,
  debt: 2_428_828_558_641_358_278_199n,
  maxBorrowingCapacity: 10_000n * ONE,
  interestRateBps: 100n,
};

const snapshot = (over: Partial<TroveSnapshot> = {}): TroveSnapshot => ({
  trove: LIVE,
  troveStatus: 1,
  pool: HARNESS_POOL,
  market: { price: PRICE, borrowingRate: ONE / 1000n, mcr: MCR },
  system: { coll: 15_421n * ONE, debt: 429_526_842n * ONE, ccr: (15n * ONE) / 10n, troveCount: 370n },
  recoveryMode: false,
  bosNonce: 0n,
  musdPermitNonce: 0n,
  btcPermitNonce: 0n,
  walletMusd: 0n,
  walletBtc: 0n,
  surplusBtc: 0n,
  block: { number: 16_747_127n, timestamp: 1n },
  newTroveRateBps: 100n,
  ...over,
});

// One Trove ahead holding 99.7% of all debt (lower NICR), then ours.
const QUEUE: QueueEntry[] = [
  { owner: OTHER, nicr: 1n, icr: 2n * ONE, debt: 997n * ONE },
  { owner: ME, nicr: 2n, icr: 2_829_924_057_233_575_620n, debt: 3n * ONE },
];
const network = networks.testnet;

describe("trovePageState", () => {
  it("shows nothing as the visitor's without a wallet", () => {
    const state = trovePageState({ snapshot: snapshot({ surplusBtc: ONE }), queue: QUEUE, account: undefined, network });
    expect(state.kind).toBe("none");
    if (state.kind === "none") expect(state.surplusBtc).toBe(0n);
  });

  it("reads the live Trove as Low and Low, 61% from liquidation", () => {
    const state = trovePageState({ snapshot: snapshot(), queue: QUEUE, account: ME, network });
    if (state.kind !== "trove") throw new Error("expected a Trove");
    const s = state.summary;
    expect(s.liquidationRisk).toBe("low");
    expect(s.drop).toBe(61);
    expect(s.redemption).toMatchObject({ risk: "low", debtAhead: 997n * ONE, rank: 2, total: 2 });
    if (typeof s.redemption === "object") expect(s.redemption.share).toBe((997n * ONE * ONE) / (1_000n * ONE));
    expect(s.drift).toBe(267_428_529_730_415_205_969n);
    expect(s.multiply.netValue).toBe(4_444_571_810_353_771_885_636n);
    expect(s.borrowable > 0n).toBe(true);
  });

  it("keeps the page when the queue cannot be read", () => {
    const state = trovePageState({ snapshot: snapshot(), queue: null, account: ME, network });
    if (state.kind !== "trove") throw new Error("expected a Trove");
    expect(state.summary.redemption).toBe("unreadable");
    expect(state.summary.liquidationRisk).toBe("low");
  });

  it("says redemptions skip a Trove under the MCR, and calls it liquidatable", () => {
    const under = { ...LIVE, debt: LIVE.debt * 3n, principal: LIVE.principal * 3n };
    const state = trovePageState({ snapshot: snapshot({ trove: under }), queue: QUEUE, account: ME, network });
    if (state.kind !== "trove") throw new Error("expected a Trove");
    expect(state.summary.liquidationRisk).toBe("liquidatable");
    expect(state.summary.redemption).toBe("not-applicable");
  });

  it("offers the surplus to a wallet whose Trove was closed, with the open facts", () => {
    const state = trovePageState({ snapshot: snapshot({ trove: null, troveStatus: 4, surplusBtc: ONE / 10n }), queue: QUEUE, account: ME, network });
    if (state.kind !== "none") throw new Error("expected no Trove");
    expect(state.surplusBtc).toBe(ONE / 10n);
    expect(state.open.minDebt).toBe(2_000n * ONE);
    expect(state.open.rateBps).toBe(100n);
    expect(state.open.borrowingRate).toBe(ONE / 1000n);
  });
});

describe("troveCrPlot", () => {
  it("draws the CR with the risk levels as bands", () => {
    const plot = troveCrPlot(snapshot())!;
    const lines = riskLines(MCR);
    expect(plot.bands.map((b) => b.label)).toEqual(["Liquidation", "High", "Medium"]);
    expect(plot.bands[0].to).toBeCloseTo(110);
    expect(plot.bands[1].to).toBeCloseTo(Number(lines.high) / 1e16);
    expect(plot.bands[2].to).toBeCloseTo(Number(lines.medium) / 1e16);
    expect(plot.series.points.find((p) => p.move === 0)!.value).toBeCloseTo(282.99, 1);
  });

  it("has no plot without a Trove", () => {
    expect(troveCrPlot(snapshot({ trove: null }))).toBeNull();
  });
});
