// U11 §5.6: the keyboard model for the app's small menus (the network chip; the token chip in Phase 2).

export type MenuKeyResult = { index: number } | "close" | "activate" | null;

/** What a key does in a menu of `count` items whose focused item is `index`; pure, so the components stay thin. */
export function menuKeys(key: string, index: number, count: number): MenuKeyResult {
  if (count <= 0) return key === "Escape" || key === "Tab" ? "close" : null;
  switch (key) {
    case "ArrowDown":
      return { index: (index + 1) % count };
    case "ArrowUp":
      return { index: (index - 1 + count) % count };
    case "Home":
      return { index: 0 };
    case "End":
      return { index: count - 1 };
    case "Escape":
    case "Tab":
      return "close";
    case "Enter":
    case " ":
      return "activate";
    default:
      return null;
  }
}
