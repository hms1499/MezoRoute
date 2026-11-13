const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** Whether a header link is the current page; paths compare without the trailing slash (`trailingSlash: true`). */
export function isCurrentPath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  const current = trim(pathname);
  const target = trim(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

/**
 * Below 640 px the header has room for one link (U8): the other main page. Positions shows everywhere
 * except on Positions and its flows, on Proof (U19), and on the Trove page itself (U20, not its flows), where Dashboard
 * takes its place; flow pages link back on their own. Proof and Trove are never the one link: the footer carries them.
 */
export function onMobile(href: string, pathname: string | null): boolean {
  if (href === "/proof/" || href === "/trove/") return false;
  const troveHere = pathname !== null && trim(pathname) === "/trove";
  const dashboardHere = isCurrentPath(pathname, "/positions/") || isCurrentPath(pathname, "/proof/") || troveHere;
  return href === "/" ? dashboardHere : !dashboardHere;
}

/**
 * The class that hides a header link at narrow widths, or null when it always shows. Proof (U19) waits for 768 px:
 * from 640 px a third link pushed Connect past the page up to 686 px (U19 review); the footer carries it below. U20
 * moved Proof and Trove to 1024 px (see below).
 */
export function navHideClass(href: string, pathname: string | null): string | null {
  // U20 QA: with Trove, the connected header ran past the page at 768 px (102 px with four links, 24 px with three),
  // so Proof and Trove both wait for 1024 px; below it the footer and the Dashboard's Trove card carry them.
  if (href === "/proof/" || href === "/trove/") return "max-lg:hidden";
  return onMobile(href, pathname) ? null : "max-sm:hidden";
}
