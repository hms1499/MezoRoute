import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { exposure } from "@/lib/exposure/exposure";
import { afterEntry } from "./after-entry";
import { parseEntryIntent } from "./intent";
import { entryPreview } from "./preview";
import { lpRouteDataWith, lpRouteSnapshotWith, ONE } from "./test-fixtures";

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
    expect(result.gasUnits).toBe(450_000n);
    expect(result.gasCost).toBe(450_000n * 146n);
    expect(result.deadline).toBe(1_759_600_000n + 600n);
    expect(result.block).toBeNull();
  });

  it("adds the approval and the relayer overhead for a smart account", () => {
    const result = preview("amount=100", { walletKind: "smart-account" });
    expect(result.steps).toEqual(["approve", "enter"]);
    expect(result.gasUnits).toBe(450_000n + 60_000n + 2n * 197_471n);
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
