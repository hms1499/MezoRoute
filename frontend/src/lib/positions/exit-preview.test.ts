import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { ExitIntent } from "./exit-intent";
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
    expect(preview.gasUnits).toBe(495_000n);
    expect(preview.gasCost).toBe(495_000n * 146n);
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
    expect(preview.gasUnits).toBe(495_000n + 60_000n + 2n * 197_471n);
  });

  it("has no gas cost when the gas price failed to load", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith({ gasPrice: undefined }), intent: { percent: 100, slippageBps: 100n }, walletKind: "eoa" });
    expect(preview.gasCost).toBeNull();
  });

  describe("with LP staked in the gauge", () => {
    const gauge = (staked: bigint) => ({ alive: true, rewardRate: 0n, periodFinish: 0n, totalStaked: staked, staked, earned: 5n });
    const staked = (wallet: bigint, inGauge: bigint) =>
      positionsDataWith({ snapshot: positionsSnapshotWith({ lpBalance: wallet, gauge: gauge(inGauge) }) });
    const intent: ExitIntent = { percent: 100, slippageBps: 100n };

    it("plans an unstake of the shortfall, then the permit and the exit", () => {
      const preview = exitPreview({ ...base, data: staked(0n, LIVE_EXIT_LIQUIDITY), intent, walletKind: "eoa" });
      expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY);
      expect(preview.unstake).toBe(LIVE_EXIT_LIQUIDITY);
      expect(preview.steps).toEqual(["unstake", "permit", "exit"]);
      expect(preview.block).toBeNull();
    });

    it("adds the unstake's gas", () => {
      const withUnstake = exitPreview({ ...base, data: staked(0n, LIVE_EXIT_LIQUIDITY), intent, walletKind: "eoa" });
      expect(withUnstake.gasUnits).toBe(495_000n + 155_000n);
    });

    it("pins liquidityIn, and re-quotes without the unstake once the LP is in the wallet", () => {
      const reloaded = exitPreview({ ...base, data: staked(LIVE_EXIT_LIQUIDITY, 0n), intent, liquidityIn: LIVE_EXIT_LIQUIDITY, walletKind: "eoa" });
      expect(reloaded.unstake).toBe(0n);
      expect(reloaded.steps).toEqual(["permit", "exit"]);
      expect(reloaded.quote?.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY);
    });

    it("exits staked LP too: Max covers wallet plus gauge", () => {
      const preview = exitPreview({ ...base, data: staked(10n, LIVE_EXIT_LIQUIDITY), intent, walletKind: "eoa" });
      expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY + 10n);
      expect(preview.unstake).toBe(LIVE_EXIT_LIQUIDITY);
    });
  });
});
