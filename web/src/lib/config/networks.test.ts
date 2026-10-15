import { mezoMainnet, mezoTestnet } from "@mezo-org/orangekit";
import { getAddress, isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { explorerAddressUrl, explorerTxUrl, networks } from "./networks";

describe("networks", () => {
  // Passport re-exports these from OrangeKit; importing Passport itself needs `window`.
  it("uses the chain ids Passport's Bitcoin connectors are bound to", () => {
    expect(networks.testnet.chainId).toBe(mezoTestnet.id);
    expect(networks.mainnet.chainId).toBe(mezoMainnet.id);
    expect([networks.testnet.chainId, networks.mainnet.chainId]).toEqual([31611, 31612]);
  });

  it("reads through the RPCs Passport's chains use (viem's rpc.mezo.org has no DNS record)", () => {
    expect(networks.testnet.rpcUrl).toBe(mezoTestnet.rpcUrls.default.http[0]);
    expect(networks.mainnet.rpcUrl).toBe(mezoMainnet.rpcUrls.default.http[0]);
    expect([networks.testnet.rpcUrl, networks.mainnet.rpcUrl]).toEqual(["https://rpc.test.mezo.org", "https://rpc-internal.mezo.org"]);
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
      deployBlock: 15_903_010n,
    });
  });

  it("pins the deployed mainnet executor and its 10 bps fee (M1)", () => {
    expect(networks.mainnet.executor).toEqual({
      address: "0x046449b1229C863e278f369869BA10e12bd80d9E",
      feeBps: 10n,
      deployBlock: 12_524_142n,
    });
  });

  it("offers a faucet on testnet only", () => {
    expect(networks.testnet.faucetUrl).toBe("https://faucet.test.mezo.org");
    expect(networks.mainnet.faucetUrl).toBeNull();
  });

  it("builds explorer transaction links per network", () => {
    expect(explorerTxUrl(networks.testnet, "0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
    expect(explorerTxUrl(networks.mainnet, "0xabc")).toBe("https://explorer.mezo.org/tx/0xabc");
  });

  it("links an address on each network's explorer", () => {
    expect(explorerAddressUrl(networks.mainnet, "0x046449b1229C863e278f369869BA10e12bd80d9E")).toBe(
      "https://explorer.mezo.org/address/0x046449b1229C863e278f369869BA10e12bd80d9E",
    );
    expect(explorerAddressUrl(networks.testnet, "0xB36B2E012003840951CFf00fA6b1E3237A110920")).toBe(
      "https://explorer.test.mezo.org/address/0xB36B2E012003840951CFf00fA6b1E3237A110920",
    );
  });
});
