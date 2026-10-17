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
 * except on Positions and its flows, where Dashboard takes its place; flow pages link back on their own.
 */
export function onMobile(href: string, pathname: string | null): boolean {
  const inPositions = isCurrentPath(pathname, "/positions/");
  return href === "/" ? inPositions : !inPositions;
}
