import { afterEach, describe, expect, it, vi } from "vitest";
import { safeStorage } from "@/lib/config/network-choice";
import {
  applyTheme,
  currentTheme,
  readStoredTheme,
  subscribeTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEME_SWITCHING_CLASS,
} from "./theme";

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

describe("switching without transitions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("holds transitions off while the theme flips, then releases them", () => {
    vi.useFakeTimers();
    vi.stubGlobal("getComputedStyle", vi.fn());
    const classes = new Set<string>();
    const root = {
      dataset: {} as DOMStringMap,
      classList: { add: (name: string) => void classes.add(name), remove: (name: string) => void classes.delete(name) },
    } as unknown as HTMLElement;

    applyTheme("dark", root, memoryStorage());
    expect(root.dataset.theme).toBe("dark");
    expect(classes.has(THEME_SWITCHING_CLASS)).toBe(true);
    expect(getComputedStyle).toHaveBeenCalledWith(root);

    vi.runAllTimers();
    expect(classes.has(THEME_SWITCHING_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});

describe("other tabs", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeWindow() {
    const handlers = new Set<(event: { key: string | null; newValue: string | null }) => void>();
    return {
      handlers,
      addEventListener: vi.fn((_type: string, handler: (event: { key: string | null; newValue: string | null }) => void) =>
        handlers.add(handler),
      ),
      removeEventListener: vi.fn((_type: string, handler: (event: { key: string | null; newValue: string | null }) => void) =>
        handlers.delete(handler),
      ),
      fire(event: { key: string | null; newValue: string | null }) {
        handlers.forEach((handler) => handler(event));
      },
    };
  }

  it("follows a theme chosen in another tab and notifies subscribers, without writing storage", () => {
    const win = fakeWindow();
    const root = fakeRoot();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { documentElement: root });
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    expect(win.addEventListener).toHaveBeenCalledWith("storage", expect.any(Function));

    win.fire({ key: THEME_STORAGE_KEY, newValue: "dark" });
    expect(root.dataset.theme).toBe("dark");
    win.fire({ key: "mezoroute.network", newValue: "mainnet" });
    expect(listener).toHaveBeenCalledTimes(1);
    win.fire({ key: THEME_STORAGE_KEY, newValue: "light" });
    expect("theme" in root.dataset).toBe(false);
    win.fire({ key: THEME_STORAGE_KEY, newValue: "dark" });
    win.fire({ key: null, newValue: null });
    expect("theme" in root.dataset).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    expect(win.handlers.size).toBe(0);
  });

  it("listens once however many controls subscribe", () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const first = subscribeTheme(vi.fn());
    const second = subscribeTheme(vi.fn());
    expect(win.addEventListener).toHaveBeenCalledTimes(1);
    first();
    expect(win.removeEventListener).not.toHaveBeenCalled();
    second();
    expect(win.removeEventListener).toHaveBeenCalledTimes(1);
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
