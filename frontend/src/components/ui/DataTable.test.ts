import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable, rowThClass, tableClass, tdClass, thClass } from "./DataTable";
import { StatsStrip } from "./StatsStrip";
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

describe("DataTable", () => {
  type Row = { name: string; value: string };
  const columns = [
    { key: "name", header: "Position", align: "left" as const, cell: (r: Row) => r.name },
    { key: "value", header: "Value", align: "right" as const, cell: (r: Row) => r.value },
    { key: "action", header: "", align: "right" as const, action: true, cell: (r: Row) => createElement("button", null, `Manage ${r.name}`) },
  ];
  const render = (rows: Row[]) =>
    renderToStaticMarkup(createElement(DataTable<Row>, { caption: "Your positions", columns, rows, empty: "Nothing yet" }));

  it("renders a table from 768 px and a card list below", () => {
    const out = render([
      { name: "LP", value: "2.29" },
      { name: "SP", value: "0" },
    ]);
    expect(out).toContain("<table");
    expect(out).toMatch(/<ul[^>]*md:hidden/);
    expect(out).toMatch(/<caption[^>]*sr-only[^>]*>Your positions<\/caption>/);
    expect(out.match(/<tr/g)).toHaveLength(3);
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it("renders one neutral row when empty", () => {
    const out = render([]);
    expect(out).toContain("Nothing yet");
    expect(out).not.toMatch(/<tbody[^>]*>\s*<tr[^>]*>\s*<t[dh][^>]*>LP/);
    expect(out).not.toContain("Manage");
  });
});

describe("StatsStrip", () => {
  it("renders one dt/dd per stat", () => {
    const out = renderToStaticMarkup(
      createElement(StatsStrip, {
        stats: [
          { label: "Value", value: "1" },
          { label: "BTC exposure", value: "2", tone: "btc" },
          { label: "MEZO", value: "3", note: "Not readable" },
        ],
      }),
    );
    expect(out.match(/<dt/g)).toHaveLength(3);
    expect(out.match(/<dd/g)).toHaveLength(3);
    expect(out).toContain("text-btc");
    expect(out).toContain("Not readable");
  });
});
