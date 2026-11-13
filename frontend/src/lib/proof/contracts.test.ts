import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { proofContracts } from "./contracts";

describe("proofContracts", () => {
  it("lists V2, Leverage, then V1, with their roles and terms on mainnet", () => {
    const list = proofContracts(networks.mainnet);
    expect(list.map((c) => [c.name, c.role, c.terms])).toEqual([
      ["Executor V2", "LP route, stake, BTC entry", "10 bps · 1,000 MUSD or 0.0125 BTC"],
      ["Leverage", "Leverage, Unwind, Close", "10 bps · 2,500 MUSD or 0.0125 BTC"],
      ["Executor V1", "Exit only, since V2", "10 bps · 1,000 MUSD"],
    ]);
    expect(list[0]).toMatchObject({ address: networks.mainnet.executor!.address, deployedAt: "2026-11-06" });
  });

  it("reads testnet's own caps", () => {
    expect(proofContracts(networks.testnet).map((c) => c.terms)).toEqual([
      "10 bps · 1,000,000 MUSD or 12 BTC",
      "10 bps · 1,000,000 MUSD or 12 BTC",
      "10 bps · 1,000,000 MUSD",
    ]);
  });
});
