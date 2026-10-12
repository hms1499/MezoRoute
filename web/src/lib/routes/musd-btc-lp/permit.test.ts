import { domainSeparator, recoverTypedDataAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { musdPermitDomain, permitTypedData, permitUsable, toExecutorPermit } from "./permit";

const testnet = networks.testnet;
// Anvil's first well-known test key; it holds nothing on Mezo.
const signer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcaa1db8b7d5ce6b5f");
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";

describe("musdPermitDomain", () => {
  it("hashes to the DOMAIN_SEPARATOR() of testnet MUSD (cast, 5 Oct 2026)", () => {
    expect(domainSeparator({ domain: musdPermitDomain(testnet) })).toBe(
      "0x6f9f5c5d441374bdc3939f5da85a145469d7ffbc96bfe0cce59e5de7d8f1474f",
    );
  });
});

describe("permitTypedData and toExecutorPermit", () => {
  it("produces a permit that recovers to the owner, split into v, r, s", async () => {
    const typedData = permitTypedData({
      network: testnet,
      owner: signer.address,
      spender: EXECUTOR,
      value: 5n,
      nonce: 0n,
      deadline: 1_759_600_600n,
    });
    expect(typedData.message).toEqual({ owner: signer.address, spender: EXECUTOR, value: 5n, nonce: 0n, deadline: 1_759_600_600n });
    const signature = await signer.signTypedData(typedData);
    expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(signer.address);

    const permit = toExecutorPermit(signature, 5n, 1_759_600_600n);
    expect(permit.value).toBe(5n);
    expect(permit.deadline).toBe(1_759_600_600n);
    expect([27, 28]).toContain(permit.v);
    expect(permit.r).toBe(`0x${signature.slice(2, 66)}` as Hex);
    expect(permit.s).toBe(`0x${signature.slice(66, 130)}` as Hex);
  });
});

describe("permitUsable", () => {
  const permit = { value: 5n, deadline: 1_000n, v: 27, r: "0x00", s: "0x00" } as const;

  it("needs a minute of margin before the deadline", () => {
    expect(permitUsable(permit, 939n)).toBe(true);
    expect(permitUsable(permit, 940n)).toBe(false);
    expect(permitUsable(permit, 2_000n)).toBe(false);
  });
});
