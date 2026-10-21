import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Settle } from "./Settle";

const el = (props: Record<string, unknown>, child: string) => createElement(Settle as FunctionComponent<Record<string, unknown>>, props, child);

describe("Settle (U10)", () => {
  it("marks content to settle in, staggered by its index", () => {
    const out = renderToStaticMarkup(el({ index: 2 }, "90,016 MUSD"));
    expect(out).toBe('<div class="settle" style="--i:2">90,016 MUSD</div>');
  });

  it("renders the element it is asked for, index 0 by default", () => {
    expect(renderToStaticMarkup(el({ as: "li" }, "row"))).toBe('<li class="settle" style="--i:0">row</li>');
  });

  it("keeps the caller's classes", () => {
    expect(renderToStaticMarkup(el({ className: "mt-4" }, "x"))).toContain('class="settle mt-4"');
  });
});
