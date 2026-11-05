import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { GAUGE_READS } from "@/lib/gauge/state";
import { dashboardContracts, parseDashboard, parseSnapshot, snapshotContracts, type SnapshotResults } from "./snapshot";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "./test-fixtures";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";

/** Raw multicall results; the pool reserves are (token0, token1, timestamp). */
function raw(status: number, reserves: readonly [bigint, bigint, bigint]): SnapshotResults {
  return [
    FIXTURE_PRICE,
    MCR,
    BORROWING_RATE,
    status,
    [deployerTrove.collateral, deployerTrove.principal, deployerTrove.interest, 0n, 0n, 0n],
    deployerTrove.maxBorrowingCapacity,
    120n * ONE,
    100n * ONE,
    1_000n * ONE,
    reserves,
    50n * ONE,
    20_000_000_000_000n,
    30n,
  ];
}

describe("snapshotContracts", () => {
  it("reads only the selected network's contracts, on that network's chain", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = snapshotContracts(network, ACCOUNT);
      expect(calls).toHaveLength(13);
      const allowed: string[] = Object.values(network.addresses);
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(allowed).toContain(call.address);
      }
    }
  });

  it("asks about the connected account in every per-user read", () => {
    const network = networks.testnet;
    const withArgs = snapshotContracts(network, ACCOUNT).filter(
      (call) => "args" in call && call.address !== network.addresses.poolFactory,
    );
    expect(withArgs).toHaveLength(7);
    for (const call of withArgs) expect("args" in call && call.args[0]).toBe(ACCOUNT);
  });

  it("reads the pool's swap fee from the factory, last", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = snapshotContracts(network, ACCOUNT);
      expect(calls[calls.length - 1]).toMatchObject({
        address: network.addresses.poolFactory,
        functionName: "getFee",
        args: [network.addresses.pool, false],
      });
    }
  });
});

describe("parseSnapshot", () => {
  it("parses an active Trove, with debt = principal + interest", () => {
    const snapshot = parseSnapshot(networks.testnet, raw(1, [520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(snapshot).toEqual({
      price: FIXTURE_PRICE,
      protocol: { mcr: MCR, borrowingRate: BORROWING_RATE },
      trove: deployerTrove,
      musd: 120n * ONE,
      lp: { balance: 100n * ONE, totalSupply: 1_000n * ONE, reserveMusd: 520n * ONE, reserveBtc: 6_000_000_000_000_000n },
      sp: { deposit: 50n * ONE, btcGain: 20_000_000_000_000n },
      poolFeeBps: 30n,
      gauge: null,
      block: null,
      troveDebt: null,
      protocolOwnedSp: null,
    });
  });

  it.each([0, 2, 3, 4])("treats Trove status %s (none or closed) as no Trove", (status) => {
    expect(parseSnapshot(networks.testnet, raw(status, [1n, 1n, 1n])).trove).toBeNull();
  });

  it("orders mainnet reserves by address: token0 is BTC there", () => {
    const snapshot = parseSnapshot(networks.mainnet, raw(1, [6_000_000_000_000_000n, 520n * ONE, 1n]));
    expect(snapshot.lp.reserveBtc).toBe(6_000_000_000_000_000n);
    expect(snapshot.lp.reserveMusd).toBe(520n * ONE);
  });
});

describe("dashboardContracts", () => {
  it("adds the gauge, the block, the open Trove debt, and the protocol-owned Stability Pool to the base reads", () => {
    const testnet = dashboardContracts(networks.testnet, ACCOUNT);
    expect(testnet).toHaveLength(13 + GAUGE_READS + 4);
    const names = testnet.slice(13 + GAUGE_READS).map((call) => call.functionName);
    expect(names).toEqual(["getBlockNumber", "getCurrentBlockTimestamp", "getEntireSystemDebt", "getCompoundedMUSDDeposit"]);
    expect(testnet[testnet.length - 1]).toMatchObject({ address: networks.testnet.addresses.stabilityPool, args: [networks.testnet.addresses.pcv] });
  });

  it("reads only the selected network's contracts", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const allowed: string[] = [...Object.values(network.addresses), network.gauge!.address, network.gauge!.voter];
      for (const call of dashboardContracts(network, ACCOUNT)) expect(allowed).toContain(call.address);
    }
  });

  it("pins the protocol's PCV on both networks", () => {
    expect(networks.mainnet.addresses.pcv).toBe("0x391EcC7ffEFc48cff41D0F2Bb36e38b82180B993");
    expect(networks.testnet.addresses.pcv).toBe("0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af");
  });
});

describe("parseDashboard", () => {
  const gauge = [true, 481_122_999_331_598_803n, 1_800_000_000n, 171n * ONE, 5n * ONE, 2n * ONE] as const;
  const tail = [12_000_000n, 1_790_000_000n, 3_000_000n * ONE, 14_000_000n * ONE] as const;

  it("parses the gauge, the block, the open Trove debt, and the protocol-owned share", () => {
    const results = [...raw(1, [520n * ONE, 6_000_000_000_000_000n, 1n]), ...gauge, ...tail];
    const snapshot = parseDashboard(networks.testnet, results as never);
    expect(snapshot.gauge).toEqual({
      alive: true,
      rewardRate: 481_122_999_331_598_803n,
      periodFinish: 1_800_000_000n,
      totalStaked: 171n * ONE,
      staked: 5n * ONE,
      earned: 2n * ONE,
    });
    expect(snapshot.block).toEqual({ number: 12_000_000n, timestamp: 1_790_000_000n });
    expect(snapshot.troveDebt).toBe(3_000_000n * ONE);
    expect(snapshot.protocolOwnedSp).toBe(14_000_000n * ONE);
    expect(snapshot.trove).toEqual(deployerTrove);
  });

  it("counts staked LP in lp.balance: wallet + gauge", () => {
    const results = [...raw(1, [520n * ONE, 6_000_000_000_000_000n, 1n]), ...gauge, ...tail];
    expect(parseDashboard(networks.testnet, results as never).lp.balance).toBe(100n * ONE + 5n * ONE);
  });
});
