import { describe, expect, it } from "vitest";
import { chartGeometry, chartLabels, type Series } from "./move-chart";

const MOVES = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30];
const lp: Series = { id: "lp", points: MOVES.map((move) => ({ move, value: 1000 * Math.sqrt(1 + move / 100) })) };
const sp: Series = { id: "sp", points: MOVES.map((move) => ({ move, value: 1000 })) };
const pad = { top: 10, right: 20, bottom: 30, left: 40 };

describe("chartGeometry", () => {
  const g = chartGeometry({ series: [lp, sp], width: 400, height: 160, pad });

  it("maps −30% to the left edge, +30% to the right edge, and today to the middle", () => {
    expect(g.x(-30)).toBe(40);
    expect(g.x(30)).toBe(380);
    expect(g.x(0)).toBe(210);
  });

  it("draws higher values higher (SVG y grows down) inside the plot area", () => {
    expect(g.y(1100)).toBeLessThan(g.y(900));
    expect(g.y(lp.points[12].value)).toBeGreaterThanOrEqual(10);
    expect(g.y(lp.points[0].value)).toBeLessThanOrEqual(130);
  });

  it("draws one polyline command per point", () => {
    expect(g.paths.lp.startsWith("M")).toBe(true);
    expect(g.paths.lp.match(/[ML]/g)).toHaveLength(13);
    expect(Object.keys(g.paths).sort()).toEqual(["lp", "sp"]);
  });

  it("gives three hairline ticks from the bottom to the top of the domain", () => {
    expect(g.ticks).toHaveLength(3);
    expect(g.ticks[0]).toBeLessThan(g.ticks[1]);
    expect(g.ticks[1]).toBeLessThan(g.ticks[2]);
  });

  it("stretches the domain to show each band's upper edge and clips bands to the plot", () => {
    const cr: Series = { id: "cr", points: MOVES.map((move) => ({ move, value: 336 * (1 + move / 100) })) };
    const bands = [
      { from: 0, to: 110, tone: "danger" as const, label: "Liquidation" },
      { from: 110, to: 160, tone: "warning" as const, label: "Below 160%" },
    ];
    const withBands = chartGeometry({ series: [cr], bands, width: 400, height: 160, pad });
    expect(withBands.y(110)).toBeLessThan(130);
    expect(withBands.y(160)).toBeLessThan(withBands.y(110));
    const [danger, warning] = withBands.bandRects;
    expect(danger.y + danger.height).toBeCloseTo(130, 5);
    expect(warning.y).toBeCloseTo(withBands.y(160), 5);
    expect(warning.height).toBeCloseTo(withBands.y(110) - withBands.y(160), 5);
  });

  it("keeps every coordinate finite with no series (the landing before its data loads)", () => {
    const empty = chartGeometry({ series: [], width: 400, height: 160, pad });
    expect(empty.ticks.every(Number.isFinite)).toBe(true);
    expect(empty.ticks.map(empty.y).every(Number.isFinite)).toBe(true);
  });

  it("does not collapse a flat series", () => {
    const flat = chartGeometry({ series: [sp], width: 400, height: 160, pad });
    expect(Number.isFinite(flat.y(1000))).toBe(true);
    expect(flat.y(1000)).toBeGreaterThan(10);
    expect(flat.y(1000)).toBeLessThan(130);
  });
});

describe("chartLabels", () => {
  const before: Series = { id: "lp-before", points: lp.points };

  it("labels each series at −30% and today, and drops +30% below 400 px", () => {
    const narrow = chartLabels({ series: [lp, sp, before], width: 360 });
    expect(narrow.map((l) => `${l.id}:${l.side}`)).toEqual(["lp:left", "lp:today", "sp:left", "sp:today"]);
    expect(narrow[0]).toMatchObject({ move: -30, value: lp.points[0].value });
  });

  it("keeps the +30% labels from 400 px", () => {
    const wide = chartLabels({ series: [lp], width: 400 });
    expect(wide.map((l) => l.side)).toEqual(["left", "today", "right"]);
    expect(wide[2]).toMatchObject({ move: 30, value: lp.points[12].value });
  });
});
