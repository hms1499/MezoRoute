import { describe, expect, it } from "vitest";
import { missingEnv, REQUIRED_ENV } from "./check-env.mjs";

describe("missingEnv", () => {
  it("requires the WalletConnect project id", () => {
    expect(REQUIRED_ENV).toEqual(["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]);
  });

  it("reports missing, empty, and blank values", () => {
    expect(missingEnv({})).toEqual(["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]);
    expect(missingEnv({ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "" })).toEqual(["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]);
    expect(missingEnv({ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "  " })).toEqual(["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]);
  });

  it("passes when the value is set", () => {
    expect(missingEnv({ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "abc123" })).toEqual([]);
  });
});
