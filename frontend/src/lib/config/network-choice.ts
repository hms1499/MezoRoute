import type { NetworkId } from "./networks";

/** localStorage key of the selected network. */
export const NETWORK_STORAGE_KEY = "mezoroute.network";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * localStorage that never throws. Reaching it throws in some private windows and with blocked
 * site data, and writes can exceed the quota; the app then behaves as if nothing was stored.
 */
export function safeStorage(getStorage: () => StorageLike | undefined = () => window.localStorage): StorageLike {
  let storage: StorageLike | undefined;
  try {
    storage = getStorage();
  } catch {
    storage = undefined;
  }
  return {
    getItem(key) {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage?.setItem(key, value);
      } catch {
        // Blocked or over quota: the choice is not remembered.
      }
    },
    removeItem(key) {
      try {
        storage?.removeItem(key);
      } catch {
        // Blocked: nothing to remove.
      }
    },
  };
}

/** A Storage that lives only in memory: choices are forgotten on reload, but nothing throws. */
class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  clear() {
    this.items.clear();
  }
}

/**
 * Passport builds a wagmi config at import time whose default storage reads `window.localStorage`
 * unguarded. When the browser blocks site data, that read throws and the app cannot boot, so this
 * swaps in an in-memory storage before the wallet code loads. Returns whether it did.
 */
export function ensureUsableLocalStorage(target: { localStorage: Storage }): boolean {
  try {
    target.localStorage.getItem(NETWORK_STORAGE_KEY);
    return false;
  } catch {
    Object.defineProperty(target, "localStorage", { configurable: true, value: new MemoryStorage() });
    return true;
  }
}

/** The stored network; Testnet when nothing (or an unknown value) is stored. */
export function readStoredNetwork(storage: Pick<Storage, "getItem">): NetworkId {
  const value = storage.getItem(NETWORK_STORAGE_KEY);
  return value === "mainnet" || value === "testnet" ? value : "testnet";
}

export function storeNetwork(storage: Pick<Storage, "setItem">, id: NetworkId): void {
  storage.setItem(NETWORK_STORAGE_KEY, id);
}

/**
 * Switching networks stores the choice and reloads, so the wagmi config is built once per page
 * load (Passport builds one chain per config). Selecting the active network does nothing.
 */
export function switchNetworkAndReload(
  current: NetworkId,
  requested: NetworkId,
  storage: Pick<Storage, "setItem">,
  reload: () => void,
): void {
  if (requested === current) return;
  storeNetwork(storage, requested);
  reload();
}
