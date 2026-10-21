// U10 hero (spec §5): MezoRoute's own motif. MUSD comes in from the left, converges into the MezoRoute node, and
// splits into the LP lane (above) and the Stability Pool lane (below). Pure geometry; RouteMotif.tsx draws it.

export type RouteMotif = {
  incoming: string[];
  lp: string[];
  sp: string[];
  node: { x: number; y: number; width: number; height: number };
};

const NODE = { width: 96, height: 28 };
/** The node's left edge as a share of the width. */
const NODE_AT = 0.52;
/** Lines keep this share of the height free at the top and bottom. */
const MARGIN = 0.06;

const r = (n: number) => Math.round(n * 10) / 10;

/** SVG path strings (`M`/`C` only) for a `width` × `height` box; `lanes` lines per route, twice as many coming in. */
export function routeMotif({ width, height, lanes = 6 }: { width: number; height: number; lanes?: number }): RouteMotif {
  const node = { x: r(width * NODE_AT), y: r(height / 2 - NODE.height / 2), ...NODE };
  const cy = node.y + node.height / 2;
  const out = node.x + node.width;
  const span = height * (1 - 2 * MARGIN);
  const share = (index: number, count: number) => (count === 1 ? 0.5 : index / (count - 1));

  const incoming = Array.from({ length: 2 * lanes }, (_, i) => {
    const y = r(height * MARGIN + span * share(i, 2 * lanes));
    return `M0 ${y} C ${r(node.x * 0.5)} ${y}, ${r(node.x * 0.72)} ${cy}, ${node.x} ${cy}`;
  });
  const lane = (from: number, to: number) =>
    Array.from({ length: lanes }, (_, j) => {
      const y = r(from + (to - from) * share(j, lanes));
      return `M${out} ${cy} C ${r(out + (width - out) * 0.45)} ${cy}, ${r(out + (width - out) * 0.55)} ${y}, ${width} ${y}`;
    });
  return {
    incoming,
    lp: lane(height * MARGIN, height * 0.44),
    sp: lane(height * 0.56, height * (1 - MARGIN)),
    node,
  };
}
