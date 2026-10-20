import { describe, expect, it, vi } from "vitest";
import { safeStorage } from "@/lib/config/network-choice";
import { applyTheme, currentTheme, readStoredTheme, subscribeTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

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

const fakeRoot = () => ({ dataset: {} as DOMStringMap });

describe("readStoredTheme", () => {
  it("defaults to light when nothing is stored", () => {
    expect(readStoredTheme(memoryStorage())).toBe("light");
  });

  it("returns a stored dark", () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
  });

  it.each(["light", "Dark", "", "system"])("is light for the value %j", (value) => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: value }))).toBe("light");
  });

  it("is light when storage throws", () => {
    expect(readStoredTheme(safeStorage(() => securityError()))).toBe("light");
  });
});

describe("applyTheme", () => {
  it("sets dark, then clears it for light, storing each choice and notifying subscribers", () => {
    const root = fakeRoot();
    const storage = memoryStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    applyTheme("dark", root, storage);
    expect(root.dataset.theme).toBe("dark");
    expect(currentTheme(root)).toBe("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    applyTheme("light", root, storage);
    expect("theme" in root.dataset).toBe(false);
    expect(currentTheme(root)).toBe("light");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    applyTheme("dark", root, storage);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("still switches when storage is blocked", () => {
    const root = fakeRoot();
    expect(() => applyTheme("dark", root, safeStorage(() => securityError()))).not.toThrow();
    expect(root.dataset.theme).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  const run = (localStorage: { getItem: (key: string) => string | null }) => {
    const document = { documentElement: fakeRoot() };
    new Function("document", "localStorage", THEME_INIT_SCRIPT)(document, localStorage);
    return document.documentElement.dataset;
  };

  it("reads the same key as theme.ts", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
  });

  it("sets dark before paint when dark is stored", () => {
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: "dark" })).theme).toBe("dark");
  });

  it("leaves the page light when nothing is stored", () => {
    expect("theme" in run(memoryStorage())).toBe(false);
  });

  it("does not throw when storage throws", () => {
    expect(() => run({ getItem: () => securityError() })).not.toThrow();
    expect("theme" in run({ getItem: () => securityError() })).toBe(false);
  });
});
