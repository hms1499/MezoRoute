/** "2026-11-06" → "6 Nov 2026" (the deploy date, UTC). */
export function deployDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Unix seconds → "12 Nov 13:04", in UTC. */
export function utcTime(seconds: bigint): string {
  const date = new Date(Number(seconds) * 1000);
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${day} ${time}`;
}

export const PROOF_LINK = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";
