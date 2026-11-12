import { describe, expect, it } from "vitest";
import {
  BAND_LABEL_MIN_HEIGHT,
  belowRuns,
  chartGeometry,
  chartLabels,
  clearLabels,
  gapRegions,
  labelBox,
  labelHitsLine,
  labelText,
  moveAt,
  placeLabels,
  readout,
  smoothPath,
  type Series,
} from "./move-chart";

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

  // U15: a smooth curve now, one move and one cubic segment per point after the first.
  it("draws one curve segment per point", () => {
    expect(g.paths.lp.startsWith("M")).toBe(true);
    expect(g.paths.lp.match(/M/g)).toHaveLength(1);
    expect(g.paths.lp.match(/C/g)).toHaveLength(12);
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

// U15 chart pass: one look for every chart. Smooth curves through the real points (never overshooting them), the gap
// to a reference shaded as loss or gain, the CR line coloured inside its bands, and a readout that follows the pointer.
describe("smoothPath", () => {
  const pts = [
    { x: 0, y: 100 },
    { x: 10, y: 90 },
    { x: 20, y: 85 },
    { x: 30, y: 84 },
  ];
  const path = smoothPath(pts);
  const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

  it("starts at the first point and passes through every point", () => {
    expect(path.startsWith("M0 100")).toBe(true);
    for (const p of pts.slice(1)) expect(path).toContain(`${p.x} ${p.y}`);
  });

  it("never overshoots: every control point stays between its segment's ends", () => {
    const segments = path.split("C").slice(1).map(numbers);
    segments.forEach(([, c1y, , c2y, , endY], i) => {
      const lo = Math.min(pts[i].y, endY);
      const hi = Math.max(pts[i].y, endY);
      expect(c1y).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(c1y).toBeLessThanOrEqual(hi + 1e-9);
      expect(c2y).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(c2y).toBeLessThanOrEqual(hi + 1e-9);
    });
  });

  it("draws a flat run flat and a single point as a move", () => {
    expect(numbers(smoothPath([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 5 }])).filter((_, i) => i % 2 === 1).every((y) => y === 5)).toBe(true);
    expect(smoothPath([{ x: 3, y: 4 }])).toBe("M3 4");
  });
});

describe("gapRegions", () => {
  const ref: Series = { id: "baseline", points: MOVES.map((move) => ({ move, value: 1000 })) };

  it("splits at today when the line crosses its reference there: loss below, gain above", () => {
    const regions = gapRegions(lp, ref);
    expect(regions.map((r) => r.tone)).toEqual(["loss", "gain"]);
    expect(regions[0].points[0].move).toBe(-30);
    expect(regions[0].points.at(-1)?.move).toBe(0);
    expect(regions[1].points[0].move).toBe(0);
  });

  it("inserts the crossing between two points (the landing's LP sits a little under the Stability Pool today)", () => {
    const low: Series = { id: "lp", points: lp.points.map((p) => ({ move: p.move, value: p.value - 9 })) };
    const regions = gapRegions(low, ref);
    const cross = regions[0].points.at(-1)!;
    expect(cross.move).toBeGreaterThan(0);
    expect(cross.move).toBeLessThan(5);
    expect(cross.top).toBeCloseTo(cross.bottom, 6);
  });

  it("is empty when the two lines are the same", () => {
    expect(gapRegions(ref, ref)).toEqual([]);
  });
});

describe("belowRuns", () => {
  const cr: Series = { id: "cr", points: MOVES.map((move) => ({ move, value: 201 * (1 + move / 100) })) };

  it("returns the stretch under the threshold, starting where the line crosses it", () => {
    const runs = belowRuns(cr, 160);
    expect(runs).toHaveLength(1);
    expect(runs[0][0].move).toBe(-30);
    const end = runs[0].at(-1)!;
    expect(end.value).toBeCloseTo(160, 6);
    expect(end.move).toBeGreaterThan(-25);
    expect(end.move).toBeLessThan(-20);
  });

  it("is empty when the line stays above it", () => {
    expect(belowRuns(cr, 110)).toEqual([]);
  });
});

describe("moveAt", () => {
  const plot = { left: 40, right: 460 };
  it("snaps the pointer to the nearest 5% step inside ±30%", () => {
    expect(moveAt(250, plot)).toBe(0);
    expect(moveAt(145, plot)).toBe(-15);
    expect(moveAt(10, plot)).toBe(-30);
    expect(moveAt(999, plot)).toBe(30);
  });
});

describe("readout", () => {
  const two = (v: number) => v.toFixed(2);
  const one: Series = { id: "lp", points: MOVES.map((move) => ({ move, value: 2.26 * Math.sqrt(1 + move / 100) })) };
  const base: Series = { id: "baseline", points: MOVES.map((move) => ({ move, value: 2.26 })) };

  it("names one position's value and its change from today", () => {
    expect(readout({ series: [base, one], move: -15, format: two, unit: "MUSD" })).toEqual({
      lead: "If BTC −15%",
      parts: [
        { text: "2.08 MUSD", tone: "ink" },
        { text: "−0.18 (−8%)", tone: "negative" },
      ],
    });
  });

  it("names both lines when the landing compares the LP with the Stability Pool", () => {
    const sp: Series = { id: "sp", points: MOVES.map((move) => ({ move, value: 1000 })) };
    const lp1000: Series = { id: "lp", points: MOVES.map((move) => ({ move, value: 991 * Math.sqrt(1 + move / 100) })) };
    expect(readout({ series: [lp1000, sp], move: -20, format: (v) => v.toFixed(0), unit: "MUSD" }).parts).toEqual([
      { text: "LP 886", tone: "lp" },
      { text: "Stability Pool 1000", tone: "sp" },
    ]);
  });

  it("adds what it was before on a preview", () => {
    const before: Series = { id: "lp-before", points: MOVES.map((move) => ({ move, value: 1.0 })) };
    expect(readout({ series: [one, before], move: -30, format: two, unit: "MUSD" }).parts.at(-1)).toEqual({ text: "was 1.00", tone: "muted" });
  });

  it("says Today without a change", () => {
    expect(readout({ series: [base, one], move: 0, format: two, unit: "MUSD" })).toEqual({ lead: "Today", parts: [{ text: "2.26 MUSD", tone: "ink" }] });
  });

  it("names the band a collateral ratio falls into", () => {
    const cr: Series = { id: "cr", points: MOVES.map((move) => ({ move, value: 201 * (1 + move / 100) })) };
    const bands = [
      { from: 0, to: 110, tone: "danger" as const, label: "Liquidation" },
      { from: 110, to: 160, tone: "warning" as const, label: "Below 160%" },
    ];
    expect(readout({ series: [cr], move: -30, format: (v) => `${Math.round(v)}%`, bands }).parts).toEqual([
      { text: "CR 141%", tone: "warning" },
      { text: "Below 160%", tone: "warning" },
    ]);
    expect(readout({ series: [cr], move: 0, format: (v) => `${Math.round(v)}%`, bands }).parts).toEqual([{ text: "CR 201%", tone: "ink" }]);
  });
});

// U15: a high end near the top had no room above its point, so it was clamped onto the line (a preview's "13.89").
describe("placeLabels near the edges", () => {
  const y = (value: number) => 200 - value;
  const plot = { top: 0, bottom: 200 };

  it("moves a high end's label below its point when there is no room above", () => {
    const labels = [
      { id: "lp" as const, side: "today" as const, move: 0, value: 180 },
      { id: "lp" as const, side: "right" as const, move: 30, value: 197 },
    ];
    const placed = placeLabels(labels, y, plot);
    // The text's baseline sits a line (14 px) under the point, clear of the line through it.
    expect(placed[1].y).toBe(y(197) + 14);
  });

  it("moves a low end's label above its point when there is no room below", () => {
    const labels = [
      { id: "lp" as const, side: "left" as const, move: -30, value: 4 },
      { id: "lp" as const, side: "today" as const, move: 0, value: 50 },
    ];
    const placed = placeLabels(labels, y, plot);
    expect(placed[0].y).toBe(y(4) - 6);
  });
});

describe("readout against a baseline that is not today's value (U17)", () => {
  const lp = { id: "lp" as const, points: [{ move: -30, value: 811.61 }, { move: 0, value: 970.06 }, { move: 30, value: 1106.04 }] };
  const putIn = { id: "baseline" as const, points: lp.points.map((p) => ({ move: p.move, value: 1000 })) };
  const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

  it("measures a fall from what was put in", () => {
    expect(readout({ series: [putIn, lp], move: -30, format, unit: "MUSD" }).parts).toEqual([
      { text: "811.61 MUSD", tone: "ink" },
      { text: "−188.39 (−19%)", tone: "negative" },
    ]);
  });

  it("says the gap already there today", () => {
    expect(readout({ series: [putIn, lp], move: 0, format, unit: "MUSD" }).parts).toEqual([
      { text: "970.06 MUSD", tone: "ink" },
      { text: "−29.94 (−3%)", tone: "negative" },
    ]);
  });

  it("keeps measuring from today when the baseline is today's value", () => {
    const today = { id: "baseline" as const, points: lp.points.map((p) => ({ move: p.move, value: 970.06 })) };
    expect(readout({ series: [today, lp], move: 0, format, unit: "MUSD" }).parts).toEqual([{ text: "970.06 MUSD", tone: "ink" }]);
    expect(readout({ series: [today, lp], move: -30, format, unit: "MUSD" }).parts[1]).toEqual({ text: "−158.45 (−16%)", tone: "negative" });
  });
});

// U17 §7: on the planner's Details chart and the landing chart a value label sat on its own rising line ("811.61",
// "970.06", "1,130"). A label's text box must stay clear of the line it names, inside the plot.
describe("clearLabels", () => {
  const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const rising = (today: number): Series => ({ id: "lp", points: MOVES.map((move) => ({ move, value: today * Math.sqrt(1 + move / 100) })) });
  const flat = (id: "sp" | "baseline", value: number): Series => ({ id, points: MOVES.map((move) => ({ move, value })) });
  const cases: [string, Series[]][] = [
    ["a deposit preview against what was put in", [flat("baseline", 1000), rising(970.06)]],
    ["the landing's LP beside the Stability Pool", [rising(991), flat("sp", 1000)]],
  ];

  function place(series: Series[], width: number, height: number) {
    const g = chartGeometry({ series, width, height });
    const placed = placeLabels(chartLabels({ series, width }), g.y, g.plot);
    const px = (id: string) => series.find((s) => s.id === id)!.points.map((p) => ({ x: g.x(p.move), y: g.y(p.value) }));
    return { g, placed, px, cleared: clearLabels(placed, { x: g.x, plot: g.plot, series, y: g.y, text: (label) => format(label.value) }) };
  }

  it("finds the bug it fixes: the default placement puts a label on its line", () => {
    const { g, placed, px } = place(cases[0][1], 684, 120);
    const hits = placed.filter((label) =>
      labelHitsLine(labelBox({ ...label, anchor: label.side === "right" ? "end" : "start" }, g.x, g.plot, format(label.value)), px(label.id)),
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  describe.each(cases)("%s", (_name, series) => {
    it.each([
      [360, 120],
      [684, 120],
      [684, 160],
      [340, 150],
    ])("keeps every label off its own line and inside the plot at %i × %i", (width, height) => {
      const { g, cleared, px } = place(series, width, height);
      expect(cleared.length).toBeGreaterThan(0);
      for (const label of cleared) {
        const box = labelBox(label, g.x, g.plot, format(label.value));
        expect(labelHitsLine(box, px(label.id)), `${label.id} ${label.side} at ${width}×${height}`).toBe(false);
        expect(box.top).toBeGreaterThanOrEqual(g.plot.top - 1);
        expect(box.bottom).toBeLessThanOrEqual(g.plot.bottom + 1);
        expect(box.left).toBeGreaterThanOrEqual(g.plot.left - 1);
        expect(box.right).toBeLessThanOrEqual(g.plot.right + 1);
      }
    });
  });

  it("leaves a label that is already clear where it was", () => {
    const series = [flat("sp", 1000)];
    const { placed, cleared } = place(series, 684, 120);
    expect(cleared.map((label) => label.y)).toEqual(placed.map((label) => label.y));
    expect(cleared.map((label) => label.anchor)).toEqual(["start", "start", "end"]);
  });
});

describe("labelHitsLine", () => {
  const box = { left: 10, right: 50, top: 20, bottom: 30 };

  it("sees a line through the box, and not one above, below, or beside it", () => {
    expect(labelHitsLine(box, [{ x: 0, y: 40 }, { x: 60, y: 10 }])).toBe(true);
    expect(labelHitsLine(box, [{ x: 0, y: 5 }, { x: 60, y: 12 }])).toBe(false);
    expect(labelHitsLine(box, [{ x: 0, y: 45 }, { x: 60, y: 38 }])).toBe(false);
    expect(labelHitsLine(box, [{ x: 60, y: 25 }, { x: 90, y: 25 }])).toBe(false);
  });
});
