import { describe, expect, it } from "vitest";
import { menuKeys, triggerKey } from "./menu";

// U11 §5.6: the keyboard model of the app's small menus (network, token chip): arrows wrap, Home/End jump,
// Escape closes, Enter and Space choose.

describe("menuKeys", () => {
  it("moves with the arrows and wraps", () => {
    expect(menuKeys("ArrowDown", 1, 2)).toEqual({ index: 0 });
    expect(menuKeys("ArrowDown", 0, 2)).toEqual({ index: 1 });
    expect(menuKeys("ArrowUp", 0, 2)).toEqual({ index: 1 });
  });

  it("jumps with Home and End", () => {
    expect(menuKeys("Home", 1, 2)).toEqual({ index: 0 });
    expect(menuKeys("End", 0, 2)).toEqual({ index: 1 });
  });

  it("closes on Escape and Tab, chooses on Enter and Space", () => {
    expect(menuKeys("Escape", 0, 2)).toBe("close");
    expect(menuKeys("Tab", 0, 2)).toBe("close");
    expect(menuKeys("Enter", 1, 2)).toBe("activate");
    expect(menuKeys(" ", 0, 2)).toBe("activate");
  });

  it("ignores other keys", () => {
    expect(menuKeys("a", 0, 2)).toBeNull();
  });
});

describe("triggerKey", () => {
  // The ARIA menu-button pattern: Enter, Space, and ArrowDown open on the checked item; ArrowUp opens on the last.
  it("opens on the checked item or the last", () => {
    expect(triggerKey("ArrowDown", 0, 2)).toBe(0);
    expect(triggerKey("Enter", 1, 2)).toBe(1);
    expect(triggerKey(" ", 1, 2)).toBe(1);
    expect(triggerKey("ArrowUp", 0, 2)).toBe(1);
    expect(triggerKey("a", 0, 2)).toBeNull();
  });
});
