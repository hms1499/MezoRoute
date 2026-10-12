import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { exitPreview } from "./exit-preview";
import { LIVE_EXIT_LIQUIDITY, positionsDataWith, positionsSnapshotWith } from "./test-fixtures";

const testnet = networks.testnet;
const base = { network: testnet, walletChainId: testnet.chainId, now: 1_000_000 };

describe("exitPreview", () => {
  it("quotes the chosen share for an EOA: permit then exit, deadline 10 minutes after the block", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith(), intent: { percent: 50, slippageBps: 100n }, walletKind: "eoa" });
    expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY);
    expect(preview.quote?.musdOut).toBe(39936013820348314126n);
    expect(preview.minimums?.minMusdOut).toBe(39536653682144830984n);
    expect(preview.steps).toEqual(["permit", "exit"]);
    expect(preview.gasUnits).toBe(400_000n);
    expect(preview.gasCost).toBe(400_000n * 146n);
    expect(preview.deadline).toBe(1_790_903_700n + 600n);
    expect(preview.block).toBeNull();
  });

  it("uses a pinned liquidityIn instead of the percent, and blocks when it exceeds the balance", () => {
    const data = positionsDataWith({ snapshot: positionsSnapshotWith({ lpBalance: LIVE_EXIT_LIQUIDITY }) });
    const preview = exitPreview({ ...base, data, intent: { percent: 100, slippageBps: 100n }, liquidityIn: LIVE_EXIT_LIQUIDITY + 1n, walletKind: "eoa" });
    expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY + 1n);
    expect(preview.block?.reason).toBe("lp-changed");
  });

  it("adds the approval and relayer gas for a smart account", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith(), intent: { percent: 100, slippageBps: 100n }, walletKind: "smart-account" });
    expect(preview.steps).toEqual(["approve", "exit"]);
    expect(preview.gasUnits).toBe(400_000n + 60_000n + 2n * 197_471n);
  });

  it("has no gas cost when the gas price failed to load", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith({ gasPrice: undefined }), intent: { percent: 100, slippageBps: 100n }, walletKind: "eoa" });
    expect(preview.gasCost).toBeNull();
  });
});
