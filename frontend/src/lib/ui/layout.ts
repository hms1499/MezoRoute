// The two page widths (DESIGN.md → Layout): wide pages (Dashboard, Positions) fill the shell; flow pages (amount,
// confirm, exit, withdraw, receipt) sit in one centred 520 px column, so a flow's left edge never moves. The mainnet
// banner (AppShell) and every state of a flow route (FlowPage) follow the same rule.

/** The flow column's width class. */
export const FLOW_WIDTH = "max-w-[520px]";

const FLOW_PREFIXES = ["/route/", "/trove/", "/tx/", "/positions/lp/", "/positions/stability-pool/"];

/** Flow routes laid out at page width: the LP planner's two columns (amount card and its aside, 10 Nov). */
const WIDE_ROUTES = ["/route/lp/"];

/** Whether a route is a 520 px flow page (the export uses trailing slashes; a path without one is matched the same). */
export function isFlowPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (WIDE_ROUTES.includes(path)) return false;
  return FLOW_PREFIXES.some((prefix) => path.startsWith(prefix));
}
