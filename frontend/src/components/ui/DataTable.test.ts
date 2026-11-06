import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { rowThClass, tableClass, tdClass, thClass } from "./DataTable";
import { Stat } from "./Stat";

// U11 §5.6: one table style. Header 12/500 muted; rows 14/400 with 12 px padding; figures right-aligned.

describe("table style", () => {
  it("heads columns at 12/500, figures on the right", () => {
    for (const part of ["text-xs", "font-medium", "text-muted", "text-right"]) expect(thClass("right")).toContain(part);
    expect(thClass("left")).toContain("text-left");
  });

  it("sets rows at 14/400 with 12 px padding, or 12 px in a dense side table", () => {
    expect(tableClass()).toContain("text-sm");
    expect(tableClass(true)).toContain("text-xs");
    expect(tdClass("right")).toContain("py-3");
    expect(tdClass("right")).toContain("text-right");
    expect(tdClass("right", true)).toContain("py-2");
    expect(rowThClass()).toContain("font-normal");
    expect(rowThClass()).toContain("text-left");
  });
});

describe("one role per figure", () => {
  it("lets a Stat carry the xl/500 figure role", () => {
    const out = renderToStaticMarkup(createElement("dl", null, createElement(Stat, { label: "Value", figure: true } as never, "2.29 MUSD")));
    expect(out).toContain("text-xl font-medium");
  });
});
