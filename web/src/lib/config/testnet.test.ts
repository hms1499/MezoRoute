import { getAddress, isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { explorerTxUrl, testnet } from "./testnet";

describe("testnet config", () => {
  it("pins Mezo testnet chain id 31611", () => {
    expect(testnet.chainId).toBe(31611);
  });

  it.each(Object.entries(testnet.addresses))("%s is a checksummed address", (_name, address) => {
    expect(isAddress(address, { strict: true })).toBe(true);
    expect(getAddress(address)).toBe(address);
  });

  it("pins the deployed executor and its 10 bps fee (spec 11.1)", () => {
    expect(testnet.addresses.executor).toBe("0xB36B2E012003840951CFf00fA6b1E3237A110920");
    expect(testnet.executorFeeBps).toBe(10n);
  });

  it("builds explorer transaction links", () => {
    expect(explorerTxUrl("0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
  });
});
