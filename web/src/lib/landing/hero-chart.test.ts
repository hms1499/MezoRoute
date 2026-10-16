import { describe, expect, it } from "vitest";
import { heroSeries } from "./hero-chart";
import { simulateRoutes } from "./simulate";
import { ONE, reference } from "./test-fixtures";

const toMusd = (wei: bigint) => Number(wei) / 1e18;

describe("heroSeries", () => {
  it("is empty before the mainnet figures load", () => {
    expect(heroSeries(null)).toEqual([]);
  });

  const sim = simulateRoutes({ reference, history: null, amount: 1_000n * ONE, executorFeeBps: 10n });
  if (sim.lp.status !== "ok") throw new Error("expected an LP quote");
  const lp = sim.lp;
  const [lpLine, spLine] = heroSeries(sim);

  it("keeps the Stability Pool flat at the amount", () => {
    expect(spLine.id).toBe("sp");
    expect(new Set(spLine.points.map((p) => p.value))).toEqual(new Set([1000]));
  });

  it("starts the LP line at today's position value and matches the simulator's −30% row", () => {
    expect(lpLine.id).toBe("lp");
    expect(lpLine.points).toHaveLength(13);
    expect(lpLine.points.find((p) => p.move === 0)!.value).toBe(toMusd(lp.positionValue));
    expect(lpLine.points.find((p) => p.move === -30)!.value).toBe(toMusd(lp.valueAfterDrop));
  });

  it("rises with the BTC price", () => {
    const values = lpLine.points.map((p) => p.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("shows only the Stability Pool when the LP cannot be quoted", () => {
    expect(heroSeries({ ...sim, lp: { status: "unavailable" } }).map((s) => s.id)).toEqual(["sp"]);
  });
});
