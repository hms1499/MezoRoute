import { describe, expect, it } from "vitest";
import { requireWalletView } from "./require-wallet";

describe("requireWalletView", () => {
  it("shows the page for a connected account", () => {
    expect(requireWalletView("connected", true)).toBe("connected");
  });

  it("waits only while an earlier session reconnects", () => {
    expect(requireWalletView("reconnecting", false)).toBe("loading");
  });

  it("keeps the fallback (the landing) behind the wallet modal while the user connects, so cancelling changes nothing", () => {
    expect(requireWalletView("connecting", false)).toBe("fallback");
    expect(requireWalletView("disconnected", false)).toBe("fallback");
    expect(requireWalletView("connected", false)).toBe("fallback");
  });
});
