import { describe, expect, it } from "vitest";
import { troveRisks } from "@/lib/leverage/risks";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { ROUTE_SECTIONS } from "./sections";

describe("landing route sections (U10, U16)", () => {
  it("tells the LP route, the Stability Pool, then the Trove", () => {
    expect(ROUTE_SECTIONS.map((section) => section.route)).toEqual(["lp", "sp", "trove"]);
    expect(ROUTE_SECTIONS.map((section) => section.pill)).toEqual(["MUSD/BTC LP", "Stability Pool", "Your Trove"]);
    expect(ROUTE_SECTIONS.map((section) => section.title)).toEqual([
      "Collect swap fees or MEZO",
      "Back the system",
      "Unwind, close, or lever up in one transaction",
    ]);
  });

  it("alternates the illustration's side, as morpho.org does", () => {
    expect(ROUTE_SECTIONS.map((section) => section.illustration)).toEqual(["right", "left", "right"]);
  });

  it("copy no longer claims LP pays only fees", () => {
    expect(LP_RETURN_SOURCE).toBe("Swap fees from traders, or MEZO from the gauge if you stake");
    expect(LP_RISKS).toContain("MEZO rewards change weekly and are paid in a token whose price can fall.");
    expect(ROUTE_SECTIONS[0].body).toContain("MEZO");
  });

  it("takes its return source and first risk from the one copy source", () => {
    expect(ROUTE_SECTIONS[0].body).toBe(`${LP_RETURN_SOURCE}.`);
    expect(ROUTE_SECTIONS[0].risk).toBe(LP_RISKS[0]);
    expect(ROUTE_SECTIONS[1].body).toBe(`${SP_RETURN_SOURCE}.`);
    expect(ROUTE_SECTIONS[1].risk).toBe(SP_RISKS[0]);
    expect(ROUTE_SECTIONS[2].risk).toBe(troveRisks("leverage")[0]);
  });

  it("says how each route is sent as short icon facts, not a sentence (U16)", () => {
    expect(ROUTE_SECTIONS[0].facts).toEqual([
      { icon: "tx", text: "One transaction in" },
      { icon: "sign", text: "Permit or approval" },
      { icon: "exit", text: "Unstake, exit to MUSD" },
    ]);
    expect(ROUTE_SECTIONS[1].facts).toEqual([
      { icon: "sign", text: "Approve, then deposit" },
      { icon: "exit", text: "Withdraw to exit" },
    ]);
    expect(ROUTE_SECTIONS[2].facts).toEqual([
      { icon: "tx", text: "One transaction" },
      { icon: "sign", text: "Authorisation and permit" },
      { icon: "oracle", text: "Oracle cost and queue shown" },
      { icon: "wallet", text: "EVM wallets only" },
    ]);
  });

  it("plans LP without a wallet, sends the Stability Pool to its page, and connects for the Trove", () => {
    expect(ROUTE_SECTIONS.map((section) => section.action)).toEqual([
      { kind: "plan", route: "lp", label: "Plan an LP deposit" },
      { kind: "plan", route: "sp", label: "Deposit to the Stability Pool" },
      { kind: "connect", label: "Connect to manage your Trove" },
    ]);
  });
});
