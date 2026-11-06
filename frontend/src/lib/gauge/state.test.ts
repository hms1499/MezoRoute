import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { GAUGE_READS, gaugeContracts, parseGaugeState } from "./state";

const account = "0x00000000000000000000000000000000000000aa";

describe("gauge state", () => {
  it("reads six values in a fixed order from the voter and the gauge", () => {
    const calls = gaugeContracts(networks.testnet, account);
    expect(calls).toHaveLength(GAUGE_READS);
    expect(calls.map((c) => c.functionName)).toEqual(["isAlive", "rewardRate", "periodFinish", "totalSupply", "balanceOf", "earned"]);
    expect(calls[0]!.address).toBe(networks.testnet.gauge!.voter);
    expect(calls[0]!.args).toEqual([networks.testnet.gauge!.address]);
    expect(calls[1]!.address).toBe(networks.testnet.gauge!.address);
    expect(calls[4]!.args).toEqual([account]);
    expect(calls[5]!.args).toEqual([account]);
  });

  it("reads nothing when the network has no gauge", () => {
    expect(gaugeContracts({ ...networks.testnet, gauge: null }, account)).toEqual([]);
  });

  it("parses the results", () => {
    expect(parseGaugeState([true, 5n, 100n, 7n, 3n, 2n])).toEqual({
      alive: true,
      rewardRate: 5n,
      periodFinish: 100n,
      totalStaked: 7n,
      staked: 3n,
      earned: 2n,
    });
  });
});
