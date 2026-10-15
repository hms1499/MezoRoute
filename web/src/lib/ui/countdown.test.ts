import { describe, expect, it } from "vitest";
import { quoteCountdown } from "./countdown";

const TTL = 60_000;

describe("quoteCountdown", () => {
  it("starts full", () => {
    expect(quoteCountdown(1_000, 1_000, TTL)).toEqual({ secondsLeft: 60, remaining: 1, expired: false });
  });

  it("rounds the seconds up and shrinks the bar", () => {
    const c = quoteCountdown(15_500, 0, TTL);
    expect(c.secondsLeft).toBe(45);
    expect(c.remaining).toBeCloseTo(44_500 / 60_000, 10);
    expect(c.expired).toBe(false);
  });

  it("expires only after the TTL, like the confirm gate (age > TTL)", () => {
    expect(quoteCountdown(60_000, 0, TTL)).toEqual({ secondsLeft: 0, remaining: 0, expired: false });
    expect(quoteCountdown(60_001, 0, TTL).expired).toBe(true);
  });

  it("treats a clock behind the quote as a fresh quote", () => {
    expect(quoteCountdown(0, 5_000, TTL)).toEqual({ secondsLeft: 60, remaining: 1, expired: false });
  });
});
