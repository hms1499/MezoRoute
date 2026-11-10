import { describe, expect, it } from "vitest";
import { checkMetadata } from "./check-metadata.mjs";

const lp = '<title>Add liquidity | MezoRoute</title><meta property="og:image" content="https://mezoroute.vercel.app/og.png"/>';
const confirm = '<title>Review your deposit | MezoRoute</title><meta name="robots" content="noindex"/>';
const notFound = "<title>Page not found | MezoRoute</title>";

describe("checkMetadata", () => {
  it("passes when the LP page has its title and share image, Confirm is noindex, and the 404 has its title", () => {
    expect(checkMetadata({ lp, confirm, notFound })).toEqual({ ok: true });
  });

  it("fails when the LP page keeps the root title", () => {
    expect(checkMetadata({ lp: "<title>MezoRoute</title>", confirm, notFound })).toMatchObject({ ok: false });
  });

  it("fails when the LP page has no share image", () => {
    expect(checkMetadata({ lp: "<title>Add liquidity | MezoRoute</title>", confirm, notFound })).toMatchObject({ ok: false });
  });

  it("fails when Confirm loses the brand (a nested segment without the template)", () => {
    expect(checkMetadata({ lp, confirm: '<title>Review your deposit</title><meta name="robots" content="noindex"/>', notFound })).toMatchObject({
      ok: false,
    });
  });

  it("fails when Confirm can be indexed", () => {
    expect(checkMetadata({ lp, confirm: "<title>Review your deposit | MezoRoute</title>", notFound })).toMatchObject({ ok: false });
  });

  it("fails when the 404 has Next's default title", () => {
    expect(checkMetadata({ lp, confirm, notFound: "<title>404: This page could not be found.</title>" })).toMatchObject({
      ok: false,
    });
  });
});
