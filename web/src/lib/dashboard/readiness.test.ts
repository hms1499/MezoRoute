import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { readiness, readinessCopy, troveWarning, type Readiness } from "./readiness";
import { atRiskTrove, deployerTrove, MCR, ONE, snapshotWith } from "./test-fixtures";

const MAINNET_GAS_PRICE = 1_462_500n;
const ROOM = 242_200_593_184_119_916_984n; // borrowHeadroom of the deployer Trove

function check(overrides: Partial<Parameters<typeof readiness>[0]> = {}) {
  return readiness({
    snapshot: snapshotWith(),
    gasBalance: ONE,
    gasPrice: 146n,
    walletKind: "eoa",
    ...overrides,
  });
}

describe("readiness", () => {
  it("needs gas before anything else", () => {
    const result = check({ snapshot: snapshotWith({ musd: 120n * ONE, trove: deployerTrove }), gasBalance: 0n });
    expect(result.state).toBe("needs-gas");
  });

  it("needs gas below the budget at the current gas price", () => {
    const budget = MAINNET_GAS_PRICE * 3_000_000n;
    expect(check({ gasBalance: budget - 1n, gasPrice: MAINNET_GAS_PRICE }).state).toBe("needs-gas");
    expect(check({ gasBalance: budget, gasPrice: MAINNET_GAS_PRICE }).state).not.toBe("needs-gas");
  });

  it("zero balance always needs gas, whatever the gas price reads", () => {
    expect(check({ gasBalance: 0n, gasPrice: undefined }).state).toBe("needs-gas");
    expect(check({ gasBalance: 0n, gasPrice: 0n }).state).toBe("needs-gas");
  });

  it("accepts any non-zero balance when the gas price is unknown", () => {
    expect(check({ gasBalance: 1n, gasPrice: undefined }).state).not.toBe("needs-gas");
  });

  it("is ready with at least 1 MUSD, ahead of borrowing", () => {
    const result = check({ snapshot: snapshotWith({ musd: 120n * ONE, trove: deployerTrove }) });
    expect(result).toEqual({ state: "ready", borrowable: ROOM, health: "healthy" });
  });

  it("does not count dust MUSD as ready", () => {
    expect(check({ snapshot: snapshotWith({ musd: ONE - 1n }) }).state).toBe("no-trove");
  });

  it("can borrow with a standard wallet and room on the Trove", () => {
    expect(check({ snapshot: snapshotWith({ trove: deployerTrove }) })).toEqual({
      state: "can-borrow",
      borrowable: ROOM,
      health: "healthy",
    });
  });

  it.each(["smart-account", "unknown"] as const)("sends a %s wallet to the Mezo app to borrow", (walletKind) => {
    expect(check({ snapshot: snapshotWith({ trove: deployerTrove }), walletKind }).state).toBe("borrow-in-mezo");
  });

  it("has no room on a Trove below the floor, and reports its health", () => {
    expect(check({ snapshot: snapshotWith({ trove: atRiskTrove }) })).toEqual({
      state: "no-room",
      borrowable: 0n,
      health: "at-risk",
    });
  });

  it("has nothing to start with: no MUSD and no Trove", () => {
    expect(check()).toEqual({ state: "no-trove", borrowable: 0n, health: null });
  });
});

describe("readinessCopy", () => {
  const testnet = networks.testnet;
  const mainnet = networks.mainnet;
  const state = (s: Readiness["state"], borrowable = 0n): Readiness => ({ state: s, borrowable, health: null });
  const context = { musd: 120n * ONE, walletKind: "eoa" as const, network: testnet };

  it("sends testnet users to the faucet and mainnet users to the Mezo app for gas", () => {
    expect(readinessCopy(state("needs-gas"), context)).toEqual({
      tone: "attention",
      tag: "Needs gas",
      headline: "You need BTC on Mezo to pay for transactions.",
      action: { label: "Get test BTC", href: "https://faucet.test.mezo.org" },
    });
    expect(readinessCopy(state("needs-gas"), { ...context, network: mainnet }).action).toEqual({
      label: "Open Mezo app",
      href: "https://mezo.org",
    });
  });

  it("offers borrowing next to ready MUSD only to a standard wallet with room", () => {
    expect(readinessCopy(state("ready", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Ready",
      headline: "You have 120 MUSD ready to deploy.",
      detail: "You can also borrow up to 242.2 MUSD.",
    });
    expect(readinessCopy(state("ready", ROOM), { ...context, walletKind: "smart-account" }).detail).toBeUndefined();
    expect(readinessCopy(state("ready", 0n), context).detail).toBeUndefined();
  });

  it("words each borrowing and empty state", () => {
    expect(readinessCopy(state("can-borrow", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Can borrow",
      headline: "Borrow up to 242.2 MUSD against your Trove and deploy it in one transaction.",
    });
    expect(readinessCopy(state("borrow-in-mezo", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Can borrow",
      headline: "Your Trove can borrow up to 242.2 MUSD.",
      detail: "Borrow it in the Mezo app first; Borrow & Deploy needs a standard wallet signature.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
    expect(readinessCopy(state("no-room"), context)).toEqual({
      tone: "neutral",
      tag: "No MUSD",
      headline: "Your Trove has no room to borrow above a 160% collateral ratio.",
      detail: "Add collateral in the Mezo app.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
    expect(readinessCopy(state("no-trove"), context)).toEqual({
      tone: "neutral",
      tag: "No MUSD",
      headline: "You need MUSD to start.",
      detail: "Open a Trove in the Mezo app to borrow MUSD against BTC.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
  });
});

describe("troveWarning", () => {
  it("is silent for a healthy Trove or none", () => {
    expect(troveWarning(null, MCR)).toBeNull();
    expect(troveWarning("healthy", MCR)).toBeNull();
  });

  it("warns about an at-risk Trove with the spec's copy", () => {
    expect(troveWarning("at-risk", MCR)).toEqual({
      tone: "warning",
      message:
        "Your Trove is at risk: a 30% BTC drop would make it liquidatable. Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.",
    });
  });

  it("names the MCR read from the chain when the Trove can be liquidated", () => {
    expect(troveWarning("liquidatable", MCR)).toEqual({
      tone: "danger",
      message: "Your Trove is below the 110% minimum and can be liquidated.",
    });
  });
});
