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
 * except on Positions and its flows, and on Proof (U19), where Dashboard takes its place; flow pages link back on
 * their own. Proof itself is never the one link: the footer carries it at every width.
 */
export function onMobile(href: string, pathname: string | null): boolean {
  if (href === "/proof/") return false;
  const dashboardHere = isCurrentPath(pathname, "/positions/") || isCurrentPath(pathname, "/proof/");
  return href === "/" ? dashboardHere : !dashboardHere;
}

/**
 * The class that hides a header link at narrow widths, or null when it always shows. Proof (U19) waits for 768 px:
 * from 640 px a third link pushed Connect past the page up to 686 px (U19 review); the footer carries it below.
 */
export function navHideClass(href: string, pathname: string | null): string | null {
  if (href === "/proof/") return "max-md:hidden";
  return onMobile(href, pathname) ? null : "max-sm:hidden";
}
