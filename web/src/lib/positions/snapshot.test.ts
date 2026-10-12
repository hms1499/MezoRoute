import { encodeFunctionData, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { FIXTURE_PRICE } from "@/lib/dashboard/test-fixtures";
import { parsePositionsSnapshot, positionsContracts, type PositionsResults } from "./snapshot";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
const ONE = 10n ** 18n;

function results(reserves: readonly [bigint, bigint, bigint]): PositionsResults {
  return [
    FIXTURE_PRICE,
    2n * ONE, // LP balance
    1_000n * ONE, // total supply
    reserves,
    520n * ONE, // pool MUSD balance
    6_000_000_000_000_000n, // pool BTC balance
    4n, // fee bps
    3n * ONE, // index0
    5n * ONE, // index1
    2n * ONE, // supplyIndex0
    4n * ONE, // supplyIndex1
    10n, // claimable0
    20n, // claimable1
    9n, // allowance
    1n, // permit nonce
    15936716n,
    1_759_600_000n,
  ];
}

describe("positionsContracts", () => {
  it("reads only allowlisted addresses on the selected network", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = positionsContracts(network, ACCOUNT);
      expect(calls).toHaveLength(17);
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(Object.values(network.addresses)).toContain(call.address);
      }
    }
  });

  it("encodes every call against its ABI", () => {
    for (const call of positionsContracts(networks.testnet, ACCOUNT)) {
      expect(() => encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0])).not.toThrow();
    }
  });

  it("reads the LP allowance to the executor, or to the zero address before one is deployed", () => {
    const allowance = (network: (typeof networks)["testnet"]) => {
      const call = positionsContracts(network, ACCOUNT).find((item) => item.functionName === "allowance");
      return call && "args" in call ? call.args : undefined;
    };
    expect(allowance(networks.testnet)).toEqual([ACCOUNT, networks.testnet.executor!.address]);
    expect(allowance(networks.mainnet)).toEqual([ACCOUNT, zeroAddress]);
  });
});

describe("parsePositionsSnapshot", () => {
  it("maps reserves and fees by token on testnet (MUSD is token0)", () => {
    const parsed = parsePositionsSnapshot(networks.testnet, results([520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(parsed.pool).toEqual({
      reserveMusd: 520n * ONE,
      reserveBtc: 6_000_000_000_000_000n,
      balanceMusd: 520n * ONE,
      balanceBtc: 6_000_000_000_000_000n,
      totalSupply: 1_000n * ONE,
      feeBps: 4n,
    });
    // claimable + balance × (index − supplyIndex) / 1e18 = 10 + 2e18, 20 + 2e18
    expect(parsed.fees).toEqual({ musd: 2n * ONE + 10n, btc: 2n * ONE + 20n });
    expect(parsed).toMatchObject({ price: FIXTURE_PRICE, lpBalance: 2n * ONE, allowance: 9n, permitNonce: 1n, blockNumber: 15936716n });
  });

  it("swaps reserves and fees on mainnet (BTC is token0)", () => {
    const parsed = parsePositionsSnapshot(networks.mainnet, results([6_000_000_000_000_000n, 520n * ONE, 1n]));
    expect(parsed.pool.reserveMusd).toBe(520n * ONE);
    expect(parsed.pool.reserveBtc).toBe(6_000_000_000_000_000n);
    expect(parsed.fees).toEqual({ musd: 2n * ONE + 20n, btc: 2n * ONE + 10n });
  });
});
