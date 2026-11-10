import { describe, expect, it } from "vitest";
import { BAND_LABEL_MIN_HEIGHT, chartGeometry, chartLabels, labelText, placeLabels, type Series } from "./move-chart";

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

describe("placeLabels (12 px chart text, U6)", () => {
  const y = (value: number) => 100 - value;
  const plot = { top: 0, bottom: 200 };

  it("keeps two labels on the same side at least 14 px apart", () => {
    const [a, b] = placeLabels(
      [
        { id: "lp", side: "today", move: 0, value: 50 },
        { id: "sp", side: "today", move: 0, value: 54 },
      ],
      y,
      plot,
    );
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(14);
  });

  it("shows a band label only from 14 px of band height", () => {
    expect(BAND_LABEL_MIN_HEIGHT).toBe(14);
  });
});

// U15: a fitted axis drew every position corner to corner. The relative scale spans today's value × (1 ± 30%), what a
// position fully in BTC would do, so a half-BTC LP rises about half as steeply and a MUSD deposit stays flat.
describe("chartGeometry with a relative scale", () => {
  const scale = { around: 1000, spread: 0.3 };
  const g = chartGeometry({ series: [lp], width: 400, height: 160, pad, scale });

  it("keeps today's value × (1 ± 30%) inside the plot", () => {
    expect(g.y(700)).toBeLessThanOrEqual(g.plot.bottom);
    expect(g.y(1300)).toBeGreaterThanOrEqual(g.plot.top);
  });

  it("puts a flat position across the middle, not the edge", () => {
    const flat = chartGeometry({ series: [sp], width: 400, height: 160, pad, scale });
    expect(Math.abs(flat.y(1000) - (flat.plot.top + flat.plot.bottom) / 2)).toBeLessThan(1);
  });

  it("leaves the LP's −30% end well above the floor, unlike the fitted axis", () => {
    const fitted = chartGeometry({ series: [lp], width: 400, height: 160, pad });
    // About 19 px higher in a 120 px plot: the end sits a sixth of the way up instead of on the floor.
    expect(g.y(lp.points[0].value)).toBeLessThan(fitted.y(lp.points[0].value) - 15);
  });

  it("only widens the range: data outside it stays in view", () => {
    const wide = chartGeometry({ series: [{ id: "lp", points: [{ move: -30, value: 100 }, { move: 30, value: 2000 }] }], width: 400, height: 160, pad, scale });
    expect(wide.y(100)).toBeLessThanOrEqual(wide.plot.bottom);
    expect(wide.y(2000)).toBeGreaterThanOrEqual(wide.plot.top);
  });
});

describe("labelText", () => {
  const format = (v: number) => v.toFixed(2);
  it("adds the change from today at the ends", () => {
    expect(labelText({ side: "left", value: 1.89, today: 2.25 }, format)).toBe("1.89 (−16%)");
    expect(labelText({ side: "right", value: 2.57, today: 2.25 }, format)).toBe("2.57 (+14%)");
  });

  it("keeps Today's label and a zero change plain", () => {
    expect(labelText({ side: "today", value: 2.25, today: 2.25 }, format)).toBe("2.25");
    expect(labelText({ side: "left", value: 20, today: 20 }, format)).toBe("20.00 (0%)");
    expect(labelText({ side: "left", value: 5, today: 0 }, format)).toBe("5.00");
  });
});

// U15: an end label above a rising line's low end sat on the line ("1.89 (−16%)" was struck through). An end lower
// than today puts its label below the point, where the line never runs.
describe("placeLabels at the ends", () => {
  const y = (value: number) => 200 - value;
  const plot = { top: 0, bottom: 200 };
  const rising = [
    { id: "lp" as const, side: "left" as const, move: -30, value: 80 },
    { id: "lp" as const, side: "today" as const, move: 0, value: 100 },
    { id: "lp" as const, side: "right" as const, move: 30, value: 115 },
  ];

  it("puts a low end's label below its point and a high end's above", () => {
    const placed = placeLabels(rising, y, plot);
    expect(placed[0].y).toBeGreaterThan(y(80));
    expect(placed[2].y).toBeLessThan(y(115));
  });

  it("mirrors it for a falling line", () => {
    const falling = rising.map((l) => ({ ...l, value: 200 - l.value }));
    const placed = placeLabels(falling, y, plot);
    expect(placed[0].y).toBeLessThan(y(120));
    expect(placed[2].y).toBeGreaterThan(y(85));
  });
});
