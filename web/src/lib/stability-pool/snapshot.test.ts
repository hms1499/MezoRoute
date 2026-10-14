import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { SnapshotResults } from "@/lib/dashboard/snapshot";
import { parseSpSnapshot, spContracts, type SpResults } from "./snapshot";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
const ONE = 10n ** 18n;

const dashboardResults: SnapshotResults = [
  86_000n * ONE,
  1_100_000_000_000_000_000n,
  1_000_000_000_000_000n,
  0,
  [0n, 0n, 0n, 0n, 0n, 0n],
  0n,
  500n * ONE,
  0n,
  1_000n * ONE,
  [100n * ONE, 1n * ONE, 0n],
  40n * ONE,
  7n,
];

describe("spContracts", () => {
  it("reads the dashboard, the initial deposit, the MUSD allowance to the pool, and the block, on the selected chain", () => {
    const contracts = spContracts(networks.testnet, ACCOUNT);
    expect(contracts).toHaveLength(15);
    expect(contracts.every((call) => call.chainId === 31611)).toBe(true);
    expect(contracts[12]).toMatchObject({ address: networks.testnet.addresses.stabilityPool, functionName: "deposits", args: [ACCOUNT] });
    expect(contracts[13]).toMatchObject({
      address: networks.testnet.addresses.musd,
      functionName: "allowance",
      args: [ACCOUNT, networks.testnet.addresses.stabilityPool],
    });
    expect(contracts[14]).toMatchObject({ functionName: "getBlockNumber" });
  });
});

describe("parseSpSnapshot", () => {
  it("splits the dashboard part from the Stability Pool tail", () => {
    const results: SpResults = [...dashboardResults, 50n * ONE, 3n * ONE, 16_000_000n];
    const snapshot = parseSpSnapshot(networks.testnet, results);
    expect(snapshot.dashboard.sp).toEqual({ deposit: 40n * ONE, btcGain: 7n });
    expect(snapshot.dashboard.musd).toBe(500n * ONE);
    expect(snapshot).toMatchObject({ initialDeposit: 50n * ONE, allowance: 3n * ONE, blockNumber: 16_000_000n });
  });
});
