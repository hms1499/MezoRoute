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

/** On `<html>` for one frame while the theme flips, so buttons do not fade while the rest of the page flips. */
export const THEME_SWITCHING_CLASS = "theme-switching";

/** `<html>`, or a bare `{ dataset }` in tests that only check the attribute. */
type ThemeRoot = HTMLElement | { dataset: DOMStringMap };

const listeners = new Set<() => void>();

/** A theme chosen in another tab; a cleared storage (`key` null) means light. Storage is already written. */
function onStorage(event: { key: string | null; newValue: string | null }): void {
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
  setRootTheme(event.newValue === DARK_THEME ? "dark" : "light", document.documentElement);
}

/** For `useSyncExternalStore`: the header and footer controls, and other open tabs, show the same state. */
export function subscribeTheme(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Dark sets `<html data-theme="dark">`, light removes it (light is the CSS default). */
function setRootTheme(theme: Theme, root: ThemeRoot): void {
  const element = "classList" in root ? root : null;
  element?.classList.add(THEME_SWITCHING_CLASS);
  if (theme === "dark") root.dataset.theme = DARK_THEME;
  else delete root.dataset.theme;
  if (element) {
    // Reading a style makes the browser apply the new colours while transitions are off.
    getComputedStyle(element);
    setTimeout(() => element.classList.remove(THEME_SWITCHING_CLASS), 0);
  }
  listeners.forEach((listener) => listener());
}

/** Switches the page and stores the choice. */
export function applyTheme(
  theme: Theme,
  root: ThemeRoot = document.documentElement,
  storage: StorageLike = safeStorage(),
): void {
  setRootTheme(theme, root);
  storage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Runs in `<head>` before the body paints, so a stored dark never flashes light first. Light needs nothing,
 * so with storage blocked (it throws in some private windows) the page simply stays light.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})===${JSON.stringify(
  DARK_THEME,
)})document.documentElement.dataset.theme=${JSON.stringify(DARK_THEME)}}catch(e){}`;
