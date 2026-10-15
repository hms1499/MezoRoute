/** Joins class names, skipping false, null, undefined, and empty strings. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
