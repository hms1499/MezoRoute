import { describe, expect, it } from "vitest";
import { routeMotif } from "./route-motif";

/** The last point of an SVG path, as numbers. */
const end = (d: string) => d.trim().split(/[\s,]+/).slice(-2).map(Number);

describe("routeMotif (U10 hero)", () => {
  const motif = routeMotif({ width: 600, height: 520 });
  const centre = motif.node.y + motif.node.height / 2;

  it("brings twice the lanes in and fans them out into an LP and a Stability Pool lane", () => {
    expect(motif.incoming).toHaveLength(12);
    expect(motif.lp).toHaveLength(6);
    expect(motif.sp).toHaveLength(6);
    expect(routeMotif({ width: 600, height: 520, lanes: 4 }).incoming).toHaveLength(8);
  });

  it("centres the MezoRoute node vertically, past the middle of the width", () => {
    expect(centre).toBe(260);
    expect(motif.node.x).toBeGreaterThanOrEqual(0.5 * 600);
    expect(motif.node.x + motif.node.width).toBeLessThanOrEqual(0.7 * 600);
  });

  it("runs the incoming lines from the left edge into the node", () => {
    for (const d of motif.incoming) {
      expect(d.startsWith("M0 ")).toBe(true);
      expect(end(d)).toEqual([motif.node.x, centre]);
    }
  });

  it("runs the lanes from the node to the right edge, LP above and the Stability Pool below", () => {
    const start = `M${motif.node.x + motif.node.width} ${centre} `;
    for (const d of [...motif.lp, ...motif.sp]) {
      expect(d.startsWith(start)).toBe(true);
      expect(end(d)[0]).toBe(600);
    }
    for (const d of motif.lp) expect(end(d)[1]).toBeLessThan(centre);
    for (const d of motif.sp) expect(end(d)[1]).toBeGreaterThan(centre);
  });

  it("stays inside the box", () => {
    for (const d of [...motif.incoming, ...motif.lp, ...motif.sp])
      for (const value of d.replace(/[MCL]/g, " ").trim().split(/[\s,]+/).map(Number)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(600);
      }
  });
});
