import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { claimableFees, type FeeState } from "./fees";

// LP 0x72D8…Cd2c on testnet at block 16112427 (cast, 12 Oct 2026); `claimFees()` simulated from it
// returned (18526950177266249, 28708139080).
const LIVE: FeeState = {
  lpBalance: 9370591955800361344281n,
  index0: 1731822510731387278n,
  index1: 97052834217934n,
  supplyIndex0: 1731820533593735286n,
  supplyIndex1: 97052831154292n,
  claimable0: 0n,
  claimable1: 0n,
};

describe("claimableFees", () => {
  it("matches the live claimFees() simulation (testnet token0 is MUSD)", () => {
    expect(claimableFees(networks.testnet, LIVE)).toEqual({ musd: 18526950177266249n, btc: 28708139080n });
  });

  it("adds the stored claimable to the accrued share", () => {
    expect(claimableFees(networks.testnet, { ...LIVE, claimable0: 5n, claimable1: 7n })).toEqual({
      musd: 18526950177266254n,
      btc: 28708139087n,
    });
  });

  it("maps by token address on mainnet, where token0 is BTC", () => {
    expect(claimableFees(networks.mainnet, LIVE)).toEqual({ musd: 28708139080n, btc: 18526950177266249n });
  });

  it("accrues nothing without LP; stored fees stay claimable after a full exit", () => {
    expect(claimableFees(networks.testnet, { ...LIVE, lpBalance: 0n, claimable0: 73915791430n, claimable1: 3690796n })).toEqual({
      musd: 73915791430n,
      btc: 3690796n,
    });
  });
});
