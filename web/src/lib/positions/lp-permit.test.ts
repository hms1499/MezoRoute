import { domainSeparator, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lpPermitDomain, lpPermitTypedData } from "./lp-permit";

const testnet = networks.testnet;
// Anvil's first well-known test key; it holds nothing on Mezo.
const signer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcaa1db8b7d5ce6b5f");
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";

describe("lpPermitDomain", () => {
  it("hashes to the pool's DOMAIN_SEPARATOR() on testnet (cast, 12 Oct 2026)", () => {
    expect(domainSeparator({ domain: lpPermitDomain(testnet) })).toBe(
      "0x4f950a79ec8129e56185827b701ba8fc3158291539b5483d715b8e48c2b67131",
    );
  });
});

describe("lpPermitTypedData", () => {
  it("produces a permit for the executor that recovers to the owner", async () => {
    const typedData = lpPermitTypedData({
      network: testnet,
      owner: signer.address,
      spender: EXECUTOR,
      value: 7n,
      nonce: 0n,
      deadline: 1_791_778_000n,
    });
    expect(typedData.domain.verifyingContract).toBe(testnet.addresses.pool);
    const signature = await signer.signTypedData(typedData);
    expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(signer.address);
  });
});
