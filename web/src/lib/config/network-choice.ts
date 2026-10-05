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
