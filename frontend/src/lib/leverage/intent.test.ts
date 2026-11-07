import { describe, expect, it } from "vitest";
import { intentQuery, parseIntent } from "./intent";
import { ONE } from "./test-fixtures";

const q = (s: string) => new URLSearchParams(s);

describe("trove intent", () => {
  it("parses the target CR in percent, the BTC amount and a slippage preset", () => {
    expect(parseIntent("unwind", q("cr=250&slippage=1"))).toEqual({ cr: (25n * ONE) / 10n, btc: null, slippageBps: 100n });
    // No preset in the URL: the app-wide default, 1% (DEFAULT_SLIPPAGE).
    expect(parseIntent("open", q("cr=200&btc=0.045"))).toEqual({ cr: 2n * ONE, btc: (45n * ONE) / 1000n, slippageBps: 100n });
  });

  it("drops what an action does not use and anything malformed", () => {
    expect(parseIntent("close", q("cr=250&btc=1"))).toEqual({ cr: null, btc: null, slippageBps: 100n });
    expect(parseIntent("leverage", q("cr=abc&slippage=7"))).toEqual({ cr: null, btc: null, slippageBps: 100n });
  });

  it("round-trips through the URL", () => {
    expect(intentQuery("open", { cr: 2n * ONE, btc: (45n * ONE) / 1000n, slippageBps: 100n })).toBe("cr=200&btc=0.045&slippage=1");
    expect(intentQuery("close", { cr: null, btc: null, slippageBps: 50n })).toBe("slippage=0.5");
  });
});
