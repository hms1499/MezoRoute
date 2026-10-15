export type Countdown = { secondsLeft: number; remaining: number; expired: boolean };

/** Time left on a quote: whole seconds (rounded up) for the text, 0–1 for the bar; expired matches the gate (age > TTL). */
export function quoteCountdown(now: number, fetchedAt: number, ttlMs: number): Countdown {
  const age = Math.max(0, now - fetchedAt);
  const left = Math.max(0, ttlMs - age);
  return { secondsLeft: Math.ceil(left / 1000), remaining: left / ttlMs, expired: age > ttlMs };
}
