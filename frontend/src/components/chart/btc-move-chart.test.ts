import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/move-chart";
import { BtcMoveChart } from "./BtcMoveChart";

// U15 chart pass: one look everywhere. Smooth lines, the gap to the reference shaded as loss or gain, a readout that
// follows the pointer (and the arrow keys: the plot is a slider whose value text is the readout), a legend, and the CR
// line coloured inside its bands. The summary stays for screen readers.

const MOVES = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30];
const lp: Series = { id: "lp", points: MOVES.map((move) => ({ move, value: 2.26 * Math.sqrt(1 + move / 100) })) };
const baseline: Series = { id: "baseline", points: MOVES.map((move) => ({ move, value: 2.26 })) };
const cr: Series = { id: "cr", points: MOVES.map((move) => ({ move, value: 201 * (1 + move / 100) })) };
const bands = [
  { from: 0, to: 110, tone: "danger" as const, label: "Liquidation" },
  { from: 110, to: 160, tone: "warning" as const, label: "Below 160%" },
];
const two = (v: number) => v.toFixed(2);
const render = (plots: Parameters<typeof BtcMoveChart>[0]["plots"]) => renderToStaticMarkup(createElement(BtcMoveChart, { plots, ariaLabel: "Summary for screen readers." }));

describe("BtcMoveChart", () => {
  const out = render([{ title: "Value in MUSD", series: [baseline, lp], format: two, unit: "MUSD" }]);

  it("keeps the summary for screen readers", () => {
    expect(out).toContain('<p class="sr-only">Summary for screen readers.</p>');
  });

  it("is a slider over the BTC moves whose value text is the readout, starting at −30%", () => {
    expect(out).toMatch(/role="slider"[^>]*tabindex="0"/i);
    expect(out).toContain('aria-valuemin="-30"');
    expect(out).toContain('aria-valuemax="30"');
    expect(out).toContain('aria-valuenow="-30"');
    expect(out).toContain('aria-valuetext="If BTC −30%: 1.89 MUSD, −0.37 (−16%)"');
  });

  it("shows the readout above the plot", () => {
    expect(out).toContain(">If BTC −30%<");
    expect(out).toContain(">1.89 MUSD<");
    expect(out).toContain(">−0.37 (−16%)<");
  });

  it("shades the gap to Kept in MUSD as a loss below today and a gain above it", () => {
    expect(out).toContain('data-gap="loss"');
    expect(out).toContain('data-gap="gain"');
  });

  it("names the lines in the title row", () => {
    expect(out).toContain(">Kept in MUSD<");
    expect(out).toContain(">LP<");
  });

  it("draws smooth curves", () => {
    expect(out).toMatch(/d="M[^"]* C/);
  });

  it("colours the CR line where it falls under 160%, and only there", () => {
    const crOut = render([{ title: "Trove collateral ratio", series: [cr], bands, format: (v) => `${Math.round(v)}%` }]);
    expect(crOut).toContain('data-band="warning"');
    expect(crOut).not.toContain('data-band="danger"');
    expect(crOut).toContain('aria-valuetext="If BTC −30%: CR 141%, Below 160%"');
    expect(crOut).not.toContain("data-gap");
  });
});
