import { formatUnits } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { deployerTrove, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { exposure } from "@/lib/exposure/exposure";
import { afterEntry } from "./after-entry";
import { parseEntryIntent } from "./intent";
import type { GaugeState } from "@/lib/gauge/state";
import { entryPreview } from "./preview";
import { lpRouteDataWith, lpRouteSnapshotWith, ONE, TESTNET_POOL } from "./test-fixtures";

const testnet = networks.testnet;

function preview(query: string, overrides: Partial<Parameters<typeof entryPreview>[0]> = {}) {
  return entryPreview({
    network: testnet,
    data: lpRouteDataWith(),
    intent: parseEntryIntent(new URLSearchParams(query)),
    walletKind: "eoa",
    walletChainId: testnet.chainId,
    now: 1_000_000,
    ...overrides,
  });
}

describe("entryPreview", () => {
  it("quotes a valid amount with minimums, a permit plan, gas, deadline, and no block", () => {
    const result = preview("amount=100&slippage=1");
    expect(result.quote?.musdIn).toBe(100n * ONE);
    expect(result.minimums?.minLpOut).toBe((result.quote!.liquidity * 9_900n) / 10_000n);
    expect(result.steps).toEqual(["permit", "enter"]);
    expect(result.gasUnits).toBe(505_000n);
    expect(result.gasCost).toBe(505_000n * 146n);
    expect(result.deadline).toBe(1_759_600_000n + 600n);
    expect(result.block).toBeNull();
  });

  it("adds the approval and the relayer overhead for a smart account", () => {
    const result = preview("amount=100", { walletKind: "smart-account" });
    expect(result.steps).toEqual(["approve", "enter"]);
    expect(result.gasUnits).toBe(505_000n + 60_000n + 2n * 197_471n);
  });

  it("has no quote and a silent block without an amount", () => {
    const result = preview("");
    expect(result.quote).toBeNull();
    expect(result.after).toBeNull();
    expect(result.block).toEqual({ reason: "zero", outcome: null });
  });

  it("shows no gas cost when the gas price failed to load", () => {
    expect(preview("amount=1", { data: lpRouteDataWith({ gasPrice: undefined }) }).gasCost).toBeNull();
  });

  it("expires the quote 60 s after its snapshot was fetched", () => {
    expect(preview("amount=1", { now: 1_000_000 + 60_001 }).block?.reason).toBe("quote-expired");
  });
});

describe("afterEntry", () => {
  it("moves MUSD from the wallet into an LP share of the post-entry pool", () => {
    const snapshot = lpRouteSnapshotWith().dashboard;
    const result = preview("amount=100");
    const after = afterEntry(snapshot, result.quote!);
    expect(after.musd).toBe(snapshot.musd - 100n * ONE + result.quote!.musdRefund);
    expect(after.lp.balance).toBe(result.quote!.liquidity);
    expect(after.lp.totalSupply).toBe(result.quote!.after.totalSupply);
    expect(exposure(after).lpBtc).toBeGreaterThan(0n);
    expect(exposure(snapshot).lpBtc).toBe(0n);
  });
});

describe("entryPreview in borrow mode", () => {
  const dashboard = snapshotWith({
    trove: deployerTrove,
    musd: 3n * ONE,
    lp: { balance: 0n, totalSupply: TESTNET_POOL.totalSupply, reserveMusd: TESTNET_POOL.reserveMusd, reserveBtc: TESTNET_POOL.reserveBtc },
  });
  const data = lpRouteDataWith({ snapshot: lpRouteSnapshotWith({ dashboard }) });
  const borrowPreview = (query: string, overrides: Partial<Parameters<typeof entryPreview>[0]> = {}) =>
    preview(`${query}&mode=borrow`, { data, ...overrides });

  it("plans permit → borrow → send, adds the borrow to the Trove, and keeps the wallet MUSD", () => {
    const result = borrowPreview("amount=100");
    expect(result.steps).toEqual(["permit", "borrow", "enter"]);
    expect(result.gasUnits).toBe(880_000n);
    expect(result.borrow?.effect?.fee).toBe(100_000_000_000_000_000n);
    expect(result.after?.trove?.debt).toBe(result.borrow?.effect?.newDebt);
    expect(result.after?.musd).toBe(3n * ONE + result.quote!.musdRefund);
    expect(result.block).toBeNull();
  });

  it("allows borrowing exactly the limit and blocks one wei more", () => {
    const limit = borrowPreview("amount=1").borrow!.limit;
    expect(borrowPreview(`amount=${formatUnits(limit, 18)}`).block).toBeNull();
    expect(borrowPreview(`amount=${formatUnits(limit + 1n, 18)}`).block?.reason).toBe("above-headroom");
  });

  it("blocks a smart account", () => {
    expect(borrowPreview("amount=1", { walletKind: "smart-account" }).block?.reason).toBe("smart-account-borrow");
  });

  it("blocks without a Trove and shows no after-state", () => {
    const noTrove = lpRouteDataWith({ snapshot: lpRouteSnapshotWith({ dashboard: { ...dashboard, trove: null } }) });
    const result = borrowPreview("amount=1", { data: noTrove });
    expect(result.block?.reason).toBe("no-trove");
    expect(result.after).toBeNull();
  });
});

describe("entryPreview staking", () => {
  const now = 1_759_600_000n;
  const gauge = (overrides: Partial<GaugeState> = {}): GaugeState => ({
    alive: true,
    rewardRate: ONE / 1_000n,
    periodFinish: now + 3_600n,
    totalStaked: 1_000n * ONE,
    staked: 0n,
    earned: 0n,
    ...overrides,
  });
  const withGauge = (state: GaugeState | null) => lpRouteDataWith({ snapshot: lpRouteSnapshotWith({ gauge: state }) });

  it("stakes by default when the gauge is open, with the measured budget", () => {
    const result = preview("amount=100", { data: withGauge(gauge()) });
    expect(result.stake).toEqual({ availability: "open", on: true });
    expect(result.gasUnits).toBe(580_000n);
  });

  it("stakes=0 turns it off and uses the plain budget", () => {
    const result = preview("amount=100&stake=0", { data: withGauge(gauge()) });
    expect(result.stake).toEqual({ availability: "open", on: false });
    expect(result.gasUnits).toBe(505_000n);
  });

  it("never stakes without a live gauge, whatever the URL says", () => {
    for (const state of [null, gauge({ alive: false })]) {
      expect(preview("amount=100", { data: withGauge(state) }).stake).toEqual({ availability: "unavailable", on: false });
    }
  });

  it("sends stake=false when the gauge could not be read", () => {
    const { snapshot } = lpRouteDataWith();
    const data = lpRouteDataWith({ snapshot: { ...snapshot, gauge: null, dashboard: { ...snapshot.dashboard, gaugeReadFailed: true } } });
    const result = preview("amount=100", { data });
    expect(result.stake).toEqual({ availability: "unavailable", on: false });
    expect(result.block).toBeNull();
  });

  it("does not stake on a gauge nobody has funded for more than 8 days", () => {
    const result = preview("amount=100", { data: withGauge(gauge({ periodFinish: now - 8n * 86_400n - 1n })) });
    expect(result.stake).toEqual({ availability: "unavailable", on: false });
  });

  it("stakes between weeks: the box stays on", () => {
    const result = preview("amount=100", { data: withGauge(gauge({ periodFinish: now })) });
    expect(result.stake).toEqual({ availability: "between-weeks", on: true });
  });
});

describe("entryPreview from BTC", () => {
  const BTC_URL = "amount=0.0003&asset=btc";
  // 0.0526 BTC like the testnet deployer; gas price 146 wei as on testnet.
  const data = (gasBalance: bigint) => lpRouteDataWith({ gasBalance });

  it("quotes a BTC amount with the four BTC-route minimums and the BTC budget", () => {
    const result = preview(BTC_URL, { data: data(ONE / 20n) });
    expect(result.quote).toBeNull();
    expect(result.btcQuote?.btcIn).toBe(3n * 10n ** 14n);
    expect(result.btcMinimums?.minLpOut).toBe((result.btcQuote!.liquidity * 9_900n) / 10_000n);
    expect(result.steps).toEqual(["permit", "enter"]);
    expect(result.gasUnits).toBe(465_000n);
    expect(result.block).toBeNull();
  });

  it("uses the BTC staking budget when the LP is staked", () => {
    const now = 1_759_600_000n;
    const gauge = { alive: true, rewardRate: 1n, periodFinish: now + 3_600n, totalStaked: ONE, staked: 0n, earned: 0n };
    const staked = lpRouteDataWith({ gasBalance: ONE / 20n, snapshot: lpRouteSnapshotWith({ gauge }) });
    expect(preview(BTC_URL, { data: staked }).gasUnits).toBe(525_000n);
  });

  it("keeps four times the entry's gas units at the gas price in the wallet", () => {
    const result = preview(BTC_URL, { data: data(ONE / 20n) });
    expect(result.btc?.fillReserve).toBe(465_000n * 4n * 146n);
    expect(result.btc?.gasReserve).toBe(465_000n * 4n * 146n);
    expect(result.btc?.walletBtc).toBe(ONE / 20n);
    expect(result.btc?.maxSpendable).toBe(ONE / 20n - 465_000n * 4n * 146n);
  });

  it("reserves for the approval and the relayer on a smart account, whatever the allowance", () => {
    const result = preview(BTC_URL, { data: data(ONE / 20n), walletKind: "smart-account" });
    expect(result.steps).toEqual(["approve", "enter"]);
    expect(result.btc?.fillReserve).toBe((465_000n + 60_000n + 2n * 197_471n) * 4n * 146n);
    expect(result.btc?.gasReserve).toBe((465_000n + 60_000n + 2n * 197_471n) * 4n * 146n);
  });

  it("lets a smart account send its maximum entry after the approval was paid (no needs-gas dead end)", () => {
    const before = data(ONE / 20n);
    const max = preview(BTC_URL, { data: before, walletKind: "smart-account" }).btc!.maxSpendable;
    // The approval is mined: the allowance covers the amount, and the Safe paid for it (up to the whole approval and relay).
    const paid = (60_000n + 197_471n) * 146n;
    const afterApproval = lpRouteDataWith({
      gasBalance: ONE / 20n - paid,
      snapshot: lpRouteSnapshotWith({ btcAllowance: max }),
    });
    const maxQuery = `amount=${formatUnits(max, 18)}&asset=btc&stake=0`;
    const result = preview(maxQuery, { data: afterApproval, walletKind: "smart-account" });
    expect(result.steps).toEqual(["enter"]);
    expect(result.btc?.gasReserve).toBe((465_000n + 197_471n) * 4n * 146n);
    expect(result.block).toBeNull();
  });

  it("blocks a BTC entry while the gas price is unknown, but not a MUSD one (Ruling P18)", () => {
    const noPrice = lpRouteDataWith({ gasPrice: undefined, gasBalance: ONE / 20n });
    expect(preview(BTC_URL, { data: noPrice }).block?.reason).toBe("gas-price-unknown");
    expect(preview(BTC_URL, { data: noPrice }).btc).toMatchObject({ fillReserve: null, gasReserve: null, maxSpendable: 0n });
    expect(preview("amount=100", { data: noPrice }).block).toBeNull();
  });

  it("blocks spending the whole balance (the reserve stays) and allows the spendable maximum", () => {
    const balance = 3n * 10n ** 14n;
    expect(preview(BTC_URL, { data: data(balance) }).block?.reason).toBe("needs-gas");
    const reserve = 465_000n * 4n * 146n;
    expect(preview(BTC_URL, { data: data(balance + reserve) }).block).toBeNull();
    expect(preview(BTC_URL, { data: data(balance + reserve - 1n) }).block?.reason).toBe("needs-gas");
  });

  it("blocks above the BTC cap, from the network config", () => {
    const capped = { ...testnet, entryCapBtc: 3n * 10n ** 14n - 1n };
    expect(preview(BTC_URL, { data: data(ONE / 20n), network: capped }).block?.reason).toBe("above-cap");
  });

  it("does not offer BTC in borrow mode", () => {
    const result = preview("amount=5&mode=borrow&asset=btc");
    expect(result.btcQuote).toBeNull();
    expect(result.btc).toBeNull();
  });

  it("shows the exposure after: BTC leaves the wallet side only through the swap and the deposit", () => {
    const result = preview(BTC_URL, { data: data(ONE / 20n) });
    expect(result.after?.lp.balance).toBe(result.btcQuote!.liquidity);
    expect(result.after?.musd).toBe(lpRouteDataWith().snapshot.dashboard.musd + result.btcQuote!.musdRefund);
  });
});
