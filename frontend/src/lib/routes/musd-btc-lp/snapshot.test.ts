import { zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lpRouteContracts } from "./snapshot";

// U13: the planner reads the chain with the zero address, so this pins every account-scoped call to it. A read that
// quietly took another account would show a visitor someone else's balance.

const testnet = networks.testnet;
const executor = testnet.executor!.address;

describe("lpRouteContracts with the zero address", () => {
  const calls = lpRouteContracts(testnet, executor, zeroAddress) as readonly {
    functionName: string;
    args?: readonly unknown[];
    chainId: number;
    address: Address;
  }[];

  it("names the zero address in every account-scoped call", () => {
    for (const name of ["allowance", "nonces", "getNonce"]) {
      const found = calls.filter((call) => call.functionName === name);
      expect(found.length, name).toBeGreaterThan(0);
      for (const call of found) expect(call.args?.[0], name).toBe(zeroAddress);
    }
  });

  it("reads the selected network and the pinned executor", () => {
    expect(new Set(calls.map((call) => call.chainId))).toEqual(new Set([testnet.chainId]));
    expect(calls.some((call) => call.address === executor)).toBe(true);
  });
});
