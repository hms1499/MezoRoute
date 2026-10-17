import { describe, expect, it } from "vitest";
import { walletKindLabel, walletKindNote } from "./labels";

describe("walletKindLabel", () => {
  it.each([
    [undefined, false, "checking…"],
    ["eoa", false, "standard wallet"],
    ["smart-account", true, "Bitcoin wallet (smart account)"],
    ["smart-account", false, "smart account"],
    ["unknown", false, "unknown wallet type"],
  ] as const)("labels %s (Bitcoin wallet: %s) as %s", (kind, bitcoinWallet, expected) => {
    expect(walletKindLabel(kind, bitcoinWallet)).toBe(expected);
  });
});

describe("walletKindNote", () => {
  it("explains exact approvals for smart accounts", () => {
    expect(walletKindNote("smart-account", true)).toBe(
      "Your Bitcoin wallet acts through a smart account: approvals are exact and sent as separate transactions.",
    );
    expect(walletKindNote("smart-account", false)).toBe(
      "Your wallet is a smart account: approvals are exact and sent as separate transactions.",
    );
  });

  it("explains the fallback when the kind is unknown", () => {
    expect(walletKindNote("unknown", false)).toBe("Couldn't check your wallet type; using exact approvals.");
  });

  it("adds nothing for a standard wallet or while checking", () => {
    expect(walletKindNote("eoa", false)).toBeNull();
    expect(walletKindNote(undefined, false)).toBeNull();
  });
});
