import { describe, expect, it } from "vitest";
import { checkBundle } from "./check-relayer-bundle.mjs";

const live = 'e="https://testnet.mezo.org/api/v2/relay/transactions"';
const dead = 'e="https://test.mezo.org/api/v2/relay/transactions"';

describe("checkBundle", () => {
  it("passes when a chunk carries the live relayer and none the dead one", () => {
    expect(checkBundle(["console.log(1)", live])).toEqual({ ok: true });
  });

  it("fails when any chunk still carries the dead relayer", () => {
    expect(checkBundle([live, dead])).toMatchObject({ ok: false });
  });

  it("fails when no chunk carries the live relayer (OrangeKit missing from the bundle)", () => {
    expect(checkBundle(["console.log(1)"])).toMatchObject({ ok: false });
  });
});
