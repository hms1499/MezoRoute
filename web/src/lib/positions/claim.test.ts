import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { claimBlock } from "./claim";

const testnet = networks.testnet;
const fees = { musd: 1n, btc: 0n };

describe("claimBlock", () => {
  it("lets a claim through with fees, the right network, and gas", () => {
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: false })).toBeNull();
  });

  it("blocks in order: no executor (mainnet read-only), wrong network, nothing to claim, gas", () => {
    expect(claimBlock({ network: networks.mainnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("no-executor");
    expect(claimBlock({ network: testnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("wrong-network");
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees: { musd: 0n, btc: 0n }, lacksGas: true })).toMatchObject({
      reason: "nothing-to-claim",
      outcome: { message: "You have no fees to claim yet." },
    });
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: true })?.reason).toBe("needs-gas");
  });
});
