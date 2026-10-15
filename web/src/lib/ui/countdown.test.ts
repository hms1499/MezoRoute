import { describe, expect, it } from "vitest";
import { quoteTimer } from "./countdown";

const REFRESH = 15_000;
const TTL = 60_000;
const timer = (age: number) => quoteTimer(10_000 + age, 10_000, REFRESH, TTL);

describe("quoteTimer", () => {
  it("counts down to the next refresh while refetches arrive", () => {
    expect(timer(0)).toEqual({ phase: "fresh", secondsLeft: 15, remaining: 1 });
    const t = timer(5_500);
    expect(t.phase).toBe("fresh");
    expect(t.secondsLeft).toBe(10);
    expect(t.remaining).toBeCloseTo(9_500 / 15_000, 10);
  });

  it("waits a short grace for the refetch before warning", () => {
    expect(timer(16_000)).toEqual({ phase: "refreshing", secondsLeft: 0, remaining: 0 });
    expect(timer(20_000).phase).toBe("refreshing");
  });

  it("counts down to expiry once the refetch is late", () => {
    const t = timer(20_001);
    expect(t.phase).toBe("expiring");
    expect(t.secondsLeft).toBe(40);
    expect(t.remaining).toBeCloseTo(39_999 / 60_000, 10);
  });

  it("expires only after the TTL, like the confirm gate (age > TTL)", () => {
    expect(timer(60_000).phase).toBe("expiring");
    expect(timer(60_001)).toEqual({ phase: "expired", secondsLeft: 0, remaining: 0 });
  });

  it("treats a clock behind the quote as a fresh quote", () => {
    expect(quoteTimer(0, 5_000, REFRESH, TTL)).toEqual({ phase: "fresh", secondsLeft: 15, remaining: 1 });
  });
});
