import { describe, expect, it } from "vitest";
import config from "../../../tailwind.config";
import { scanSource } from "./source-scan";

// U11 §5.6: cards have no shadow (U3); one shadow token marks floating layers, and only overlay components use it.

/** The overlays: popovers, menus, toasts. Phase 2 adds the token-chip menu (Task 12) and the slippage popover (Task 13); U21 the icon-action tooltip. */
const OVERLAYS = ["components/ui/Term.tsx", "components/ui/IconAction.tsx", "components/ErrorToast.tsx", "components/NetworkMenu.tsx", "components/flow/TokenAmountInput.tsx", "components/flow/SlippagePopover.tsx"];

describe("shadows", () => {
  it("has one shadow token", () => {
    expect(Object.keys((config.theme?.boxShadow ?? {}) as object)).toEqual(["none", "overlay"]);
  });

  it("allows only shadow-overlay and shadow-none", () => {
    expect(scanSource([["shadow", /(?<![\w-])shadow(?:-(?!overlay\b|none\b)[\w[\]/.-]+)?(?![\w-])/]], { skip: ["lib/ui/tokens.ts"] })).toEqual([]);
  });

  it("puts shadow-overlay on overlays only", () => {
    expect(scanSource([["overlay shadow", /\bshadow-overlay\b/]], { skip: OVERLAYS })).toEqual([]);
    for (const file of OVERLAYS) expect(scanSource([["overlay shadow", /\bshadow-overlay\b/]]).some((hit) => hit.startsWith(file)), file).toBe(true);
  });
});
