import { describe, expect, it } from "vitest";
import { dashboardView } from "./view";

describe("dashboardView", () => {
  it("shows the dashboard once the data and the wallet kind are known", () => {
    expect(dashboardView({ hasData: true, walletKindKnown: true, hasError: false })).toBe("content");
  });

  it("keeps data on screen when a background refetch fails", () => {
    expect(dashboardView({ hasData: true, walletKindKnown: true, hasError: true })).toBe("content");
  });

  it("shows the error card only when there is nothing to show", () => {
    expect(dashboardView({ hasData: false, walletKindKnown: true, hasError: true })).toBe("error");
    expect(dashboardView({ hasData: false, walletKindKnown: false, hasError: true })).toBe("error");
  });

  it("waits for the first snapshot and for the wallet kind", () => {
    expect(dashboardView({ hasData: false, walletKindKnown: true, hasError: false })).toBe("loading");
    expect(dashboardView({ hasData: true, walletKindKnown: false, hasError: false })).toBe("loading");
  });
});
