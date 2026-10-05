import { describe, expect, it, vi } from "vitest";
import {
  ensureUsableLocalStorage,
  NETWORK_STORAGE_KEY,
  readStoredNetwork,
  safeStorage,
  storeNetwork,
  switchNetworkAndReload,
} from "./network-choice";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function securityError(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

describe("readStoredNetwork", () => {
  it("defaults to testnet when nothing is stored", () => {
    expect(readStoredNetwork(memoryStorage())).toBe("testnet");
  });

  it.each(["testnet", "mainnet"] as const)("returns a stored %s", (id) => {
    expect(readStoredNetwork(memoryStorage({ [NETWORK_STORAGE_KEY]: id }))).toBe(id);
  });

  it.each(["devnet", "", "Mainnet"])("falls back to testnet for the unknown value %j", (value) => {
    expect(readStoredNetwork(memoryStorage({ [NETWORK_STORAGE_KEY]: value }))).toBe("testnet");
  });
});

describe("storeNetwork", () => {
  it("writes the network under mezoroute.network", () => {
    const storage = memoryStorage();
    storeNetwork(storage, "mainnet");
    expect(storage.getItem("mezoroute.network")).toBe("mainnet");
  });
});

describe("safeStorage", () => {
  it("passes reads and writes through to a working storage", () => {
    const storage = safeStorage(() => memoryStorage());
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("acts as empty storage when localStorage cannot be reached", () => {
    const storage = safeStorage(securityError);
    expect(() => storage.setItem("k", "v")).not.toThrow();
    expect(storage.getItem("k")).toBeNull();
    expect(readStoredNetwork(storage)).toBe("testnet");
  });

  it("swallows a throwing getItem, setItem, or removeItem", () => {
    const storage = safeStorage(() => ({ getItem: securityError, setItem: securityError, removeItem: securityError }));
    expect(storage.getItem("k")).toBeNull();
    expect(() => storage.setItem("k", "v")).not.toThrow();
    expect(() => storage.removeItem("k")).not.toThrow();
  });
});

describe("switchNetworkAndReload", () => {
  it("does nothing when the requested network is already active", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    switchNetworkAndReload("testnet", "testnet", storage, reload);
    expect(storage.getItem(NETWORK_STORAGE_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("stores the new network before reloading", () => {
    const storage = memoryStorage();
    const reload = vi.fn(() => expect(storage.getItem(NETWORK_STORAGE_KEY)).toBe("mainnet"));
    switchNetworkAndReload("testnet", "mainnet", storage, reload);
    expect(reload).toHaveBeenCalledOnce();
  });
});

// Passport builds a wagmi config at import time whose default storage reads window.localStorage
// unguarded; when the browser blocks site data that getter throws and the app cannot boot.
describe("ensureUsableLocalStorage", () => {
  function windowWith(descriptor: PropertyDescriptor) {
    const target = {} as { localStorage: Storage };
    Object.defineProperty(target, "localStorage", { configurable: true, ...descriptor });
    return target;
  }

  it("leaves a working localStorage alone", () => {
    const storage = memoryStorage() as unknown as Storage;
    const target = windowWith({ value: storage });
    expect(ensureUsableLocalStorage(target)).toBe(false);
    expect(target.localStorage).toBe(storage);
  });

  it("swaps in an in-memory storage when reaching localStorage throws", () => {
    const target = windowWith({ get: securityError });
    expect(ensureUsableLocalStorage(target)).toBe(true);
    target.localStorage.setItem("k", "v");
    expect(target.localStorage.getItem("k")).toBe("v");
    expect(target.localStorage.length).toBe(1);
    expect(target.localStorage.key(0)).toBe("k");
    target.localStorage.removeItem("k");
    expect(target.localStorage.getItem("k")).toBeNull();
  });

  it("swaps in an in-memory storage when reading from it throws", () => {
    const target = windowWith({ value: { getItem: securityError } });
    expect(ensureUsableLocalStorage(target)).toBe(true);
    expect(target.localStorage.getItem("k")).toBeNull();
  });
});
