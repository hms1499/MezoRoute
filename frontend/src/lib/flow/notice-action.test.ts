import { describe, expect, it } from "vitest";
import { splitPrimary, type NoticeAction } from "./notice-action";

// U12: the blocked page's first recovery becomes its one primary; the rest stay in the notice.

describe("splitPrimary", () => {
  it("has no primary without actions", () => {
    expect(splitPrimary([])).toEqual({ primary: null, rest: [] });
  });

  it("takes the first action and keeps the order of the rest", () => {
    const a: NoticeAction = { label: "Use my balance", onClick: () => undefined };
    const b: NoticeAction = { label: "Get MUSD", href: "https://mezo.org" };
    const actions = [a, b];
    expect(splitPrimary(actions)).toEqual({ primary: a, rest: [b] });
    expect(actions).toEqual([a, b]);
  });
});
