import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { REPOSITORY } from "@/lib/config/links";
import { BeforeYouSign } from "./BeforeYouSign";

const out = renderToStaticMarkup(
  createElement(BeforeYouSign, {
    network: networks.testnet,
    feeBps: 10n,
    capMusd: 1_000_000n * 10n ** 18n,
    blockNumber: 16_700_000n,
  }),
);

describe("BeforeYouSign", () => {
  it("names the executor, its fee, the cap, and the block", () => {
    expect(out).toContain("Before you sign");
    expect(out).toContain("0x1281…6288");
    expect(out).toContain("https://explorer.test.mezo.org/address/0x1281cC769c136F9F4f291B390c8992a3Cd556288");
    expect(out).toContain("0.1%");
    expect(out).toContain("1,000,000 MUSD");
    expect(out).toContain("16,700,000");
  });

  it("says the software is unaudited and links the source", () => {
    expect(out).toContain("Unaudited software");
    expect(out).toContain(REPOSITORY);
  });

  it("shows nothing without an executor", () => {
    expect(
      renderToStaticMarkup(
        createElement(BeforeYouSign, { network: { ...networks.testnet, executor: null }, feeBps: 10n, capMusd: 1n, blockNumber: 1n }),
      ),
    ).toBe("");
  });
});
