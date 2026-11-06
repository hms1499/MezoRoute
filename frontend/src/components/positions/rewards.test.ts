import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GAUGE_READ_FAILED_POSITIONS, GAUGE_READ_FAILED_RETRY, GAUGE_READ_FAILED_SUMMARY } from "@/lib/gauge/copy";
import { PositionsTable } from "./PositionsTable";
import { RewardsCard, type RewardsCardProps } from "./RewardsCard";

// U11 §6.4: one Rewards card for MEZO and pool fees; nothing claimable reads neutral, and an unreadable gauge never
// shows 0 MEZO (Review Focus 3).

const E18 = 10n ** 18n;
const act = { onClick: () => undefined, disabled: false, pending: false };
const base: RewardsCardProps = {
  mezo: { pending: E18 / 4n, rate: "≈ 14 MEZO a week", apr: null, staked: E18 / 100n, walletLp: 0n, stakeOffered: true, notFunded: false, claim: act, stake: act, unstake: act },
  fees: { musd: 0n, btc: 0n, total: 0n, note: null, claim: act },
  btcGain: null,
  notice: null,
};
const render = (props: Partial<RewardsCardProps>) => renderToStaticMarkup(createElement(RewardsCard, { ...base, ...props }));
const primaries = (html: string) => (html.match(/<(?:button|a)\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length;

describe("RewardsCard", () => {
  it("has no Claim fees button and no danger text without fees", () => {
    const out = render({});
    expect(out).not.toContain("Claim fees");
    expect(out).not.toContain("text-danger");
    expect(out).toContain("You have no fees to claim yet.");
  });

  it("has one Claim fees button with fees", () => {
    const out = render({ fees: { musd: E18, btc: 0n, total: E18, note: null, claim: act } });
    // A Button renders its label twice (the hover roll), so count buttons, not labels.
    const buttons = out.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons.filter((button) => button.includes("Claim fees"))).toHaveLength(1);
  });

  it("says the gauge could not be read instead of showing 0 MEZO", () => {
    const out = render({ mezo: "read-failed" });
    expect(out).toContain(GAUGE_READ_FAILED_POSITIONS);
    expect(out).not.toMatch(/\b0 MEZO/);
    expect(out).not.toContain("Claim MEZO");
  });

  it("shows pending MEZO with Claim MEZO and the veBTC voters line", () => {
    const out = render({});
    expect(out).toContain("0.25 MEZO");
    expect(out).toContain("Claim MEZO");
    expect(out).toContain("veBTC voters");
  });

  it("has no primary button", () => {
    expect(primaries(render({ fees: { musd: E18, btc: 0n, total: E18, note: null, claim: act } }))).toBe(0);
  });
});

describe("PositionsTable", () => {
  const out = renderToStaticMarkup(
    createElement(PositionsTable, {
      lp: { amount: E18 / 100n, staked: E18 / 100n, wallet: 0n, value: 2n * E18, earning: "MEZO (staked)", exitHref: "/positions/lp/exit/?percent=100&slippage=1", details: createElement("p", null, "lp details") },
      sp: { deposit: 50n * E18, value: 50n * E18, withdrawHref: "/positions/stability-pool/withdraw/?percent=100", details: createElement("p", null, "sp details") },
    }),
  );

  it("has one LP row with a combined Exit and an SP row with Withdraw", () => {
    expect(out).toContain("Exit");
    expect(out).toContain("Withdraw");
    expect(out).toContain("staked");
    expect(primaries(out)).toBe(0);
  });

  it("lets each row expand to its details", () => {
    expect(out).toMatch(/aria-expanded="false"/);
  });
});

// Final review: a failed gauge read must not state "0 staked" or "no positions" as a fact (Review Focus 3).
describe("PositionsTable with a failed gauge read", () => {
  it("captions the LP row as unreadable instead of 0 staked", () => {
    const out = renderToStaticMarkup(
      createElement(PositionsTable, {
        lp: { amount: E18 / 1000n, staked: 0n, wallet: E18 / 1000n, value: E18, earning: "Swap fees", exitHref: "/x", details: null },
        sp: null,
        gaugeReadFailed: true,
      }),
    );
    expect(out).toContain(GAUGE_READ_FAILED_SUMMARY);
    expect(out).not.toContain("0 staked");
  });

  it("does not say there are no positions", () => {
    const out = renderToStaticMarkup(createElement(PositionsTable, { lp: null, sp: null, gaugeReadFailed: true }));
    expect(out).not.toMatch(/No positions/);
    expect(out).toContain(GAUGE_READ_FAILED_RETRY);
  });
});
