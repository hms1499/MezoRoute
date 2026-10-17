import { recoverTypedDataAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { borrowAuthorisationState, borrowTypedData } from "./borrow-signature";

const DEPLOYER = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

describe("borrowTypedData", () => {
  it("recovers the live 2 Oct 2026 borrow authorisation to its signer (tx 0xdebe…6259)", async () => {
    // BorrowerOperationsSignatures accepted this signature on testnet: nonce 2, 20 MUSD.
    const typedData = borrowTypedData({
      network: networks.testnet,
      borrower: DEPLOYER,
      amount: 20_000_000_000_000_000_000n,
      nonce: 2n,
      deadline: 1_790_904_394n,
    });
    expect(typedData.message.recipient).toBe(DEPLOYER);
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature:
        "0x7707dcf3e84ad2832f169f1a60bf87ed3b295de9da19019fa37acc222e176d4642385f31e362c00d2650159b4132137b799565248b607956e709d594826453b81c",
    });
    expect(signer).toBe(DEPLOYER);
  });
});

describe("borrowAuthorisationState", () => {
  const auth = { amount: 5n, nonce: 7n, deadline: 1_000n, signature: "0x00" } as const;

  it("is usable with a minute to spare and an unchanged nonce", () => {
    expect(borrowAuthorisationState(auth, 939n, 7n)).toBe("usable");
  });

  it("expires inside the last minute", () => {
    expect(borrowAuthorisationState(auth, 940n, 7n)).toBe("expired");
  });

  it("is used once the borrower's nonce has moved", () => {
    expect(borrowAuthorisationState(auth, 100n, 8n)).toBe("used");
  });
});
