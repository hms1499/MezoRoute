import { describe, expect, it } from "vitest";
import { TROVE_CONNECT } from "./connect-copy";

// U17 §7: a Trove page opened without a wallet says what the action does, not just "Connect a wallet to continue".

describe("TROVE_CONNECT", () => {
  it.each(["unwind", "close", "leverage", "open"] as const)("says what %s does, in one transaction, for EVM wallets", (action) => {
    expect(TROVE_CONNECT[action]).toMatch(/in one transaction/);
    expect(TROVE_CONNECT[action]).toMatch(/EVM wallets only\.$/);
  });

  it("tells the four actions apart", () => {
    expect(new Set(Object.values(TROVE_CONNECT)).size).toBe(4);
  });
});
