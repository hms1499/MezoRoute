import { afterEach, describe, expect, it, vi } from "vitest";
import { readTroveView, writeTroveView } from "./view-pref";

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

describe("Trove view preference", () => {
  it("defaults to Loan and remembers Multiply", () => {
    vi.stubGlobal("localStorage", fakeStorage);
    expect(readTroveView()).toBe("loan");
    writeTroveView("multiply");
    expect(store.get("mezoroute.trove-view")).toBe("multiply");
    expect(readTroveView()).toBe("multiply");
    writeTroveView("loan");
    expect(readTroveView()).toBe("loan");
  });

  it("reads Loan for anything else", () => {
    vi.stubGlobal("localStorage", fakeStorage);
    store.set("mezoroute.trove-view", "MULTIPLY");
    expect(readTroveView()).toBe("loan");
  });

  it("never throws when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readTroveView()).toBe("loan");
    expect(() => writeTroveView("multiply")).not.toThrow();
  });
});
