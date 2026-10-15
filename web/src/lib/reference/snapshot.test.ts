import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { WAD } from "@/lib/math";
import { parseReference, referenceContracts, referenceView, type ReferenceResults } from "./snapshot";

const ONE = WAD;
const network = networks.mainnet;

// Mainnet on 15 Oct 2026 (cast): token0 is BTC.
const RESULTS: ReferenceResults = [
  [1_252_333_046_250_689_046n, 101_720_411_561_710_585_148_464n, 1_792_028_034n],
  356_914_278_883_031_761_432n,
  30n,
  81_669_799_990_000_000_000_000n,
  29_871_966_506_620_911_511_760_946n,
  14_172_031_977_066_897_384_115_018n,
];

describe("referenceContracts", () => {
  it("reads only mainnet's own contracts", () => {
    const allowed: string[] = Object.values(network.addresses);
    for (const call of referenceContracts(network)) expect(allowed).toContain(call.address);
    expect(referenceContracts(network).map((c) => c.functionName)).toEqual([
      "getReserves",
      "totalSupply",
      "getFee",
      "fetchPrice",
      "totalSupply",
      "getTotalMUSDDeposits",
    ]);
  });
});

describe("parseReference", () => {
  it("maps mainnet reserves by address (BTC is token0)", () => {
    expect(parseReference(network, RESULTS)).toEqual({
      reserveMusd: 101_720_411_561_710_585_148_464n,
      reserveBtc: 1_252_333_046_250_689_046n,
      lpSupply: 356_914_278_883_031_761_432n,
      feeBps: 30n,
      price: 81_669_799_990_000_000_000_000n,
      musdSupply: 29_871_966_506_620_911_511_760_946n,
      spDeposits: 14_172_031_977_066_897_384_115_018n,
    });
  });
});

describe("referenceView", () => {
  const base = parseReference(network, RESULTS);

  it("values the pool in MUSD at the oracle price and gives the Stability Pool's share of supply", () => {
    const view = referenceView({ ...base, reserveMusd: 100n * ONE, reserveBtc: ONE / 2n, price: 80_000n * ONE, spDeposits: 14n * ONE, musdSupply: 28n * ONE });
    expect(view).toEqual({ poolTvl: 40_100n * ONE, spShare: ONE / 2n });
  });

  it("reads the live mainnet share as 47.4%", () => {
    const { spShare } = referenceView(base);
    expect(spShare).toBeGreaterThan(474_000_000_000_000_000n);
    expect(spShare).toBeLessThan(475_000_000_000_000_000n);
  });

  it("gives a zero share without MUSD supply", () => {
    expect(referenceView({ ...base, musdSupply: 0n }).spShare).toBe(0n);
  });
});
