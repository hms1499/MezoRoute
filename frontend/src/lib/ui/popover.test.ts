import { describe, expect, it } from "vitest";
import { popoverShift } from "./popover";

describe("popoverShift", () => {
  it("leaves a popover that fits where its term starts", () => {
    expect(popoverShift({ anchorLeft: 40, width: 256, viewport: 1440 })).toBe(0);
  });

  it("pulls a popover back inside the 16 px gutter when its term sits near the right edge (U8)", () => {
    // A term starting at 300 px on a 360 px phone: the 256 px popover must end at 344 px.
    expect(popoverShift({ anchorLeft: 300, width: 256, viewport: 360 })).toBe(88 - 300);
  });

  it("never starts left of the gutter", () => {
    expect(popoverShift({ anchorLeft: 4, width: 200, viewport: 360 })).toBe(12);
    expect(popoverShift({ anchorLeft: 100, width: 400, viewport: 360 })).toBe(16 - 100);
  });
});
