import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaxButton } from "./MaxButton";
import { Segmented, segmentedItemClass, segmentedKey } from "./Segmented";

// U11 §5.6: the one segmented control; the selected item is a surface chip with a line ring on a well track.

const options = [
  { value: "a", label: "One" },
  { value: "b", label: "Two" },
];
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Segmented, { label: "Pick", options, value: "b", onChange: () => undefined, ...props }));

describe("Segmented", () => {
  it("renders radio semantics", () => {
    const out = render({});
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('aria-label="Pick"');
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-checked="true"[^>]*class="[^"]*bg-surface[^"]*ring-line/);
  });

  it("renders tab semantics", () => {
    const out = render({ semantics: "tabs", options: [{ value: "a", label: "One", id: "tab-a", controls: "panel-a" }, { value: "b", label: "Two" }] });
    expect(out).toContain('role="tablist"');
    expect(out.match(/role="tab"/g)).toHaveLength(2);
    expect(out).toContain('aria-selected="true"');
    expect(out).toContain('aria-controls="panel-a"');
    expect(out).not.toContain("aria-checked");
  });

  it("has one selected look, sized md or sm", () => {
    expect(segmentedItemClass(true, "md")).toContain("bg-surface text-ink ring-1 ring-line");
    expect(segmentedItemClass(false, "md")).toContain("text-muted");
    expect(segmentedItemClass(true, "md")).toContain("min-h-9 px-4 text-sm");
    expect(segmentedItemClass(true, "sm")).toContain("min-h-7 px-3 text-xs");
    expect(render({})).toContain(segmentedItemClass(true, "md"));
  });

  it("only the selected item is in the tab order", () => {
    const out = render({});
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out.match(/tabindex="-1"/g)).toHaveLength(1);
  });

  it("moves with the arrow keys and wraps, skipping disabled items", () => {
    const values = ["a", "b", "c"];
    expect(segmentedKey("ArrowRight", "a", values, [])).toBe("b");
    expect(segmentedKey("ArrowRight", "c", values, [])).toBe("a");
    expect(segmentedKey("ArrowLeft", "a", values, [])).toBe("c");
    expect(segmentedKey("ArrowDown", "a", values, ["b"])).toBe("c");
    expect(segmentedKey("Home", "c", values, [])).toBe("a");
    expect(segmentedKey("End", "a", values, [])).toBe("c");
    expect(segmentedKey("Enter", "a", values, [])).toBeNull();
  });
});

describe("MaxButton", () => {
  it("is the one Max: an sm pill in accent on accent-soft", () => {
    const out = renderToStaticMarkup(createElement(MaxButton, { onClick: () => undefined }));
    expect(out).toContain(">Max<");
    expect(out).toContain("min-h-7 px-3 text-xs");
    expect(out).toContain("bg-accent-soft text-accent");
    expect(out).toContain("hit");
  });
});
