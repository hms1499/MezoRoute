import { mezoMainnet, mezoTestnet } from "@mezo-org/orangekit";
import { getAddress, isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { explorerTxUrl, networks } from "./networks";

describe("networks", () => {
  // Passport re-exports these from OrangeKit; importing Passport itself needs `window`.
  it("uses the chain ids Passport's Bitcoin connectors are bound to", () => {
    expect(networks.testnet.chainId).toBe(mezoTestnet.id);
    expect(networks.mainnet.chainId).toBe(mezoMainnet.id);
    expect([networks.testnet.chainId, networks.mainnet.chainId]).toEqual([31611, 31612]);
  });

  it.each(
    Object.values(networks).flatMap((network) =>
      Object.entries(network.addresses).map(([name, address]) => [`${network.id} ${name}`, address] as const),
    ),
  )("%s is a checksummed address", (_name, address) => {
    expect(isAddress(address, { strict: true })).toBe(true);
    expect(getAddress(address)).toBe(address);
  });

  it("pins the deployed testnet executor and its 10 bps fee (spec 11.1)", () => {
    expect(networks.testnet.executor).toEqual({
      address: "0xB36B2E012003840951CFf00fA6b1E3237A110920",
      feeBps: 10n,
    });
  });

  it("has no mainnet executor before M1", () => {
    expect(networks.mainnet.executor).toBeNull();
  });

  it("offers a faucet on testnet only", () => {
    expect(networks.testnet.faucetUrl).toBe("https://faucet.test.mezo.org");
    expect(networks.mainnet.faucetUrl).toBeNull();
  });

  it("builds explorer transaction links per network", () => {
    expect(explorerTxUrl(networks.testnet, "0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
    expect(explorerTxUrl(networks.mainnet, "0xabc")).toBe("https://explorer.mezo.org/tx/0xabc");
  });
});
