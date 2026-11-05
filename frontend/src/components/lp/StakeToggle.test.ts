import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GAUGE_READ_FAILED_ENTRY } from "@/lib/gauge/copy";
import { StakeToggle } from "./StakeToggle";

const render = (availability: "open" | "unavailable", readFailed = false) =>
  renderToStaticMarkup(createElement(StakeToggle, { availability, on: availability === "open", onChange: () => undefined, mezoPerWeek: null, aprLabel: null, readFailed }));

describe("StakeToggle", () => {
  it("is hidden when staking is unavailable", () => {
    expect(render("unavailable")).toBe("");
  });

  it("says the deposit will not be staked when the gauge could not be read, with no switch", () => {
    const out = render("unavailable", true);
    expect(out).toContain(GAUGE_READ_FAILED_ENTRY);
    expect(out).not.toContain('role="switch"');
  });

  it("shows the switch when staking is possible", () => {
    expect(render("open")).toContain('role="switch"');
  });
});
