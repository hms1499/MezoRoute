import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { NOTHING_TO_CLAIM, REJECTED } from "@/lib/errors/outcomes";
import { Notice } from "./Notice";

// U11 §5.5: four notice tones; an empty or "nothing to do" state is neutral, never the error colour.

const notice = (tone?: string) => renderToStaticMarkup(createElement(Notice, { tone } as never, "x"));

describe("notice tones", () => {
  it("has neutral, warning, danger, and success", () => {
    expect(notice("neutral")).toContain("bg-well text-ink");
    expect(notice()).toContain("bg-well text-ink");
    expect(notice("warning")).toContain("bg-warning-bg text-warning-ink");
    expect(notice("danger")).toContain("bg-danger-soft text-danger");
    expect(notice("success")).toContain("bg-accent-soft text-accent");
  });
});

describe("outcome tones", () => {
  it("marks nothing-to-claim as neutral", () => {
    expect(NOTHING_TO_CLAIM.tone).toBe("neutral");
    expect(REJECTED.tone).toBeUndefined();
  });

  it("renders a neutral outcome without the error colour", () => {
    const neutral = renderToStaticMarkup(createElement(BlockNotice, { block: { outcome: NOTHING_TO_CLAIM } }));
    expect(neutral).not.toContain("text-danger");
    expect(neutral).not.toContain("lucide-circle-alert");
    const danger = renderToStaticMarkup(createElement(BlockNotice, { block: { outcome: REJECTED } }));
    expect(danger).toContain("text-danger");
  });
});
