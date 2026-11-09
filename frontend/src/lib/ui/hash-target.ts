// U12: a link to `#details` should open the disclosure it points at, not just scroll to a closed one.

/** True only for `#<id>` (browsers percent-encode some characters; an empty or other hash is not a match). */
export function isHashTarget(hash: string, id: string): boolean {
  if (!hash.startsWith("#")) return false;
  try {
    return decodeURIComponent(hash.slice(1)) === id;
  } catch {
    return false;
  }
}
