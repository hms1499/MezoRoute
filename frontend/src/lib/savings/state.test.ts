import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { parseSavingsState, savingsContracts } from "./state";

describe("savings reads", () => {
  it("reads the vault, and its gauge where there is one", () => {
    expect(savingsContracts(networks.testnet)).toHaveLength(2);
    expect(savingsContracts(networks.mainnet)).toHaveLength(6);
  });

  it("parses mainnet's six values and testnet's two", () => {
    expect(parseSavingsState(networks.mainnet, [10n, 2n, true, 3n, 4n, 5n])).toEqual({
      totalSupply: 10n,
      yieldIndex: 2n,
      gauge: { alive: true, rewardRate: 3n, periodFinish: 4n, totalStaked: 5n },
    });
    expect(parseSavingsState(networks.testnet, [10n, 2n])).toEqual({ totalSupply: 10n, yieldIndex: 2n, gauge: null });
  });
});
