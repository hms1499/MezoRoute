import { describe, expect, it } from "vitest";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { ROUTE_SECTIONS } from "./sections";

describe("landing route sections (U10)", () => {
  it("tells the LP route, then the Stability Pool", () => {
    expect(ROUTE_SECTIONS.map((section) => section.route)).toEqual(["lp", "sp"]);
    expect(ROUTE_SECTIONS.map((section) => section.pill)).toEqual(["MUSD/BTC LP", "Stability Pool"]);
    expect(ROUTE_SECTIONS.map((section) => section.title)).toEqual(["Earn swap fees", "Back the system"]);
  });

  it("alternates the illustration's side, as morpho.org does", () => {
    expect(ROUTE_SECTIONS.map((section) => section.illustration)).toEqual(["right", "left"]);
  });

  it("takes its copy from the one route copy source", () => {
    expect(ROUTE_SECTIONS[0].body).toEqual([LP_RETURN_SOURCE, LP_RISKS[0]]);
    expect(ROUTE_SECTIONS[1].body).toEqual([SP_RETURN_SOURCE, SP_RISKS[0]]);
    expect(ROUTE_SECTIONS[0].txs).toBe("One transaction in, after a permit or approval; one transaction out, back to MUSD.");
    expect(ROUTE_SECTIONS[1].txs).toBe("Approve, then deposit; withdraw to exit.");
  });
});
