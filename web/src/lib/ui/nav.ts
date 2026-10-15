const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** Whether a header link is the current page; paths compare without the trailing slash (`trailingSlash: true`). */
export function isCurrentPath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  const current = trim(pathname);
  const target = trim(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}
