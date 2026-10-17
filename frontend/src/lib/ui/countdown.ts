/** A refetch may land a little after its interval; only after this grace does the page warn about expiry. */
const REFETCH_GRACE_MS = 5_000;

export type QuoteTimer = {
  phase: "fresh" | "refreshing" | "expiring" | "expired";
  secondsLeft: number; // whole seconds, rounded up
  remaining: number; // 0–1, for the bar
};

/**
 * The confirm page's quote timer. While refetches arrive it counts down to the next one; when a
 * refetch is late it counts down to the quote's expiry instead; `expired` matches the gate (age > TTL).
 */
export function quoteTimer(now: number, fetchedAt: number, refreshMs: number, ttlMs: number): QuoteTimer {
  const age = Math.max(0, now - fetchedAt);
  if (age > ttlMs) return { phase: "expired", secondsLeft: 0, remaining: 0 };
  if (age <= refreshMs) {
    const left = refreshMs - age;
    return { phase: "fresh", secondsLeft: Math.ceil(left / 1000), remaining: left / refreshMs };
  }
  if (age <= refreshMs + REFETCH_GRACE_MS) return { phase: "refreshing", secondsLeft: 0, remaining: 0 };
  const left = ttlMs - age;
  return { phase: "expiring", secondsLeft: Math.ceil(left / 1000), remaining: left / ttlMs };
}
