import { safeStorage, type StorageLike } from "@/lib/config/network-choice";
import type { Theme } from "./tokens";

export type { Theme };

/** localStorage key of the theme: one choice for the whole site, not per network. */
export const THEME_STORAGE_KEY = "mezoroute.theme";
export const DARK_THEME = "dark";

/** Light unless dark was chosen (U9): the OS setting is ignored, so a first visit is always light. */
export function readStoredTheme(storage: Pick<Storage, "getItem">): Theme {
  return storage.getItem(THEME_STORAGE_KEY) === DARK_THEME ? "dark" : "light";
}

export function currentTheme(root: { dataset: DOMStringMap }): Theme {
  return root.dataset.theme === DARK_THEME ? "dark" : "light";
}

const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: the header and footer controls show the same state. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dark sets `<html data-theme="dark">`, light removes it (light is the CSS default); the choice is stored. */
export function applyTheme(
  theme: Theme,
  root: { dataset: DOMStringMap } = document.documentElement,
  storage: StorageLike = safeStorage(),
): void {
  if (theme === "dark") root.dataset.theme = DARK_THEME;
  else delete root.dataset.theme;
  storage.setItem(THEME_STORAGE_KEY, theme);
  listeners.forEach((listener) => listener());
}

/**
 * Runs in `<head>` before the body paints, so a stored dark never flashes light first. Light needs nothing,
 * so with storage blocked (it throws in some private windows) the page simply stays light.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})===${JSON.stringify(
  DARK_THEME,
)})document.documentElement.dataset.theme=${JSON.stringify(DARK_THEME)}}catch(e){}`;
