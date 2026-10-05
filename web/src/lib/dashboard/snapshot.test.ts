import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type SnapshotResults } from "./snapshot";
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
  ];
}

describe("snapshotContracts", () => {
  it("reads only the selected network's contracts, on that network's chain", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = snapshotContracts(network, ACCOUNT);
      expect(calls).toHaveLength(12);
      const allowed: string[] = Object.values(network.addresses);
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(allowed).toContain(call.address);
      }
    }
  });

  it("asks about the connected account in every per-user read", () => {
    const withArgs = snapshotContracts(networks.testnet, ACCOUNT).filter((call) => "args" in call);
    expect(withArgs).toHaveLength(7);
    for (const call of withArgs) expect("args" in call && call.args[0]).toBe(ACCOUNT);
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
