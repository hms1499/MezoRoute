import { keepPreviousData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { savingsVaultQuery } from "./query";

describe("savingsVaultQuery (U19 review: the sMUSD column blinked on every refresh)", () => {
  it("waits for the snapshot's block, so the first read is pinned to it", () => {
    expect(savingsVaultQuery(networks.mainnet, undefined).enabled).toBe(false);
    expect(savingsVaultQuery(networks.mainnet, 13_190_069n).enabled).toBe(true);
  });

  it("keeps the last state while the next block's read is in flight", () => {
    expect(savingsVaultQuery(networks.mainnet, 1n).placeholderData).toBe(keepPreviousData);
  });

  it("never reads without a vault", () => {
    expect(savingsVaultQuery({ ...networks.mainnet, savingsVault: null }, 1n).enabled).toBe(false);
  });
});
