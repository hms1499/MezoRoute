import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { snapshotContracts, type SnapshotResults } from "@/lib/dashboard/snapshot";
import { BORROWING_RATE, FIXTURE_PRICE, MCR } from "@/lib/dashboard/test-fixtures";
import { GAUGE_READS } from "@/lib/gauge/state";
import { DASHBOARD_READS, LP_ROUTE_GAUGE_START, lpRouteContracts, parseLpRouteSnapshot, type LpRouteResults } from "./snapshot";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const ONE = 10n ** 18n;

function results(reserves: readonly [bigint, bigint, bigint]): LpRouteResults {
  const dashboard: SnapshotResults = [
    FIXTURE_PRICE,
    MCR,
    BORROWING_RATE,
    0,
    [0n, 0n, 0n, 0n, 0n, 0n],
    0n,
    120n * ONE,
    0n,
    1_000n * ONE,
    reserves,
    0n,
    0n,
    4n,
  ];
  return [
    ...dashboard,
    7n * ONE,
    3n,
    10n,
    1_000_000n * ONE,
    15936716n,
    1_759_600_000n,
    2n,
    15_413n * ONE,
    428_873_804n * ONE,
    1_500_000_000_000_000_000n,
    242n,
    4n,
    9n,
    true,
    1_000_000_000_000n,
    1_759_700_000n,
    50n * ONE,
    5n * ONE,
    2n * ONE,
  ];
}

describe("lpRouteContracts", () => {
  it("adds the LP-route reads after the dashboard's, all on the selected network", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = lpRouteContracts(network, EXECUTOR, ACCOUNT);
      expect(calls).toHaveLength(DASHBOARD_READS + 13 + GAUGE_READS);
      const allowed: string[] = [...Object.values(network.addresses), EXECUTOR, network.gauge!.address, network.gauge!.voter];
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(allowed).toContain(call.address);
      }
    }
  });

  it("encodes every call against its ABI (each function exists in the ABI it names)", () => {
    for (const call of lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT)) {
      expect(() => encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0])).not.toThrow();
    }
  });

  it("reads the borrower's BOS nonce for the account", () => {
    const calls = lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT);
    const nonce = calls.find((call) => call.functionName === "getNonce");
    expect(nonce?.address).toBe(networks.testnet.addresses.borrowerOperationsSignatures);
    expect(nonce && "args" in nonce && nonce.args).toEqual([ACCOUNT]);
  });

  it("keeps the dashboard's reads first, so DASHBOARD_READS stays true", () => {
    expect(snapshotContracts(networks.testnet, ACCOUNT)).toHaveLength(DASHBOARD_READS);
    expect(lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT).slice(0, DASHBOARD_READS)).toEqual(
      snapshotContracts(networks.testnet, ACCOUNT),
    );
  });

  it("reads the allowance from the account to the executor, and the account's permit nonce", () => {
    const calls = lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT);
    const allowance = calls.find((call) => call.functionName === "allowance");
    const nonce = calls.find((call) => call.functionName === "nonces");
    expect(allowance && "args" in allowance && allowance.args).toEqual([ACCOUNT, EXECUTOR]);
    expect(nonce && "args" in nonce && nonce.args).toEqual([ACCOUNT]);
  });
});

describe("BTC reads", () => {
  it("reads the account's BTC allowance to the executor and its BTC permit nonce from the BTC token", () => {
    const calls = lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT).filter((call) => call.address === networks.testnet.addresses.btc);
    expect(calls.map((call) => call.functionName)).toEqual(["allowance", "nonces"]);
    expect(calls.map((call) => ("args" in call ? call.args : undefined))).toEqual([[ACCOUNT, EXECUTOR], [ACCOUNT]]);
  });
});

describe("parseLpRouteSnapshot", () => {
  it("parses the gauge reads that follow the LP-route reads", () => {
    const parsed = parseLpRouteSnapshot(networks.testnet, results([520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(parsed.gauge).toEqual({
      alive: true,
      rewardRate: 1_000_000_000_000n,
      periodFinish: 1_759_700_000n,
      totalStaked: 50n * ONE,
      staked: 5n * ONE,
      earned: 2n * ONE,
    });
  });

  it("reports a failed gauge read in its dashboard, with no gauge and wallet LP only", () => {
    const withoutGauge = results([520n * ONE, 6_000_000_000_000_000n, 1n]).slice(0, LP_ROUTE_GAUGE_START) as unknown as LpRouteResults;
    const parsed = parseLpRouteSnapshot(networks.testnet, withoutGauge, true);
    expect(parsed.gauge).toBeNull();
    expect(parsed.dashboard.gaugeReadFailed).toBe(true);
    expect(parsed.dashboard.lp.balance).toBe(0n);
    expect(parsed.btcPermitNonce).toBe(9n);
  });

  it("names where the gauge's reads start", () => {
    expect(lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT)[LP_ROUTE_GAUGE_START]).toMatchObject({ functionName: "isAlive" });
  });

  it("counts staked LP in the dashboard's lp.balance", () => {
    const parsed = parseLpRouteSnapshot(networks.testnet, results([520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(parsed.dashboard.lp.balance).toBe(5n * ONE);
  });

  it("has no gauge state on a network without a gauge", () => {
    const network = { ...networks.testnet, gauge: null };
    const parsed = parseLpRouteSnapshot(network, results([520n * ONE, 6_000_000_000_000_000n, 1n]).slice(0, DASHBOARD_READS + 13) as unknown as LpRouteResults);
    expect(parsed.gauge).toBeNull();
  });

  it("parses the LP-route reads on testnet (MUSD is token0)", () => {
    const parsed = parseLpRouteSnapshot(networks.testnet, results([520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(parsed.pool).toEqual({
      reserveMusd: 520n * ONE,
      reserveBtc: 6_000_000_000_000_000n,
      totalSupply: 1_000n * ONE,
      feeBps: 4n,
    });
    expect(parsed).toMatchObject({
      allowance: 7n * ONE,
      permitNonce: 3n,
      executorFeeBps: 10n,
      maxMusdIn: 1_000_000n * ONE,
      blockNumber: 15936716n,
      blockTimestamp: 1_759_600_000n,
      borrowNonce: 2n,
      btcAllowance: 4n,
      btcPermitNonce: 9n,
      system: { coll: 15_413n * ONE, debt: 428_873_804n * ONE, ccr: 1_500_000_000_000_000_000n, troveCount: 242n },
    });
    expect(parsed.dashboard.musd).toBe(120n * ONE);
  });

  it("maps reserves by address on mainnet (BTC is token0)", () => {
    const parsed = parseLpRouteSnapshot(networks.mainnet, results([6_000_000_000_000_000n, 520n * ONE, 1n]));
    expect(parsed.pool.reserveMusd).toBe(520n * ONE);
    expect(parsed.pool.reserveBtc).toBe(6_000_000_000_000_000n);
  });
});
