import { zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { preSendCheck, quoteFor, restartsSigning, signedMinCr, troveAuthState, troveSteps } from "./steps";
import type { TroveSnapshot } from "./snapshot";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";

const snapshot: TroveSnapshot = {
  trove: trove(ONE, 40_000n * ONE),
  troveStatus: 1,
  pool: HARNESS_POOL,
  market: HARNESS_MARKET,
  system: { coll: 1_000n * ONE, debt: 20_000_000n * ONE, ccr: (15n * ONE) / 10n, troveCount: 10n },
  recoveryMode: false,
  bosNonce: 4n,
  musdPermitNonce: 2n,
  btcPermitNonce: 3n,
  walletMusd: 0n,
  walletBtc: ONE,
  surplusBtc: 0n,
  block: { number: 1n, timestamp: 1_000n },
};
const auth = { nonce: 4n, deadline: 1_600n };
const permit = { permit: { value: 1n, deadline: 1_600n, v: 27, r: zeroHash, s: zeroHash }, nonce: 3n };

describe("troveSteps", () => {
  it("lists the wallet steps per action", () => {
    expect(troveSteps("unwind", "ok")).toEqual(["authorise", "permit", "send"]);
    expect(troveSteps("close", "ok")).toEqual(["authorise", "permit", "send"]);
    expect(troveSteps("open", "ok")).toEqual(["authorise", "permit", "send"]);
    expect(troveSteps("leverage", "refinance")).toEqual(["refinance", "authorise", "permit", "send"]);
    expect(troveSteps("unwind", "refinance")).toEqual(["authorise", "permit", "send"]);
  });
});

describe("troveAuthState", () => {
  it("troveAuthState returns used when the nonce moved", () => {
    expect(troveAuthState(auth, 1_000n, 5n)).toBe("used");
    expect(troveAuthState(auth, 1_000n, 4n)).toBe("usable");
    expect(troveAuthState(auth, 1_545n, 4n)).toBe("expired");
  });
});

describe("preSendCheck", () => {
  it("passes a fresh authorisation and permit", () => {
    expect(preSendCheck({ snapshot, auth, permit, permitToken: "btc", now: 1_000n })).toBeNull();
  });

  it("stops on a used authorisation, an expired or spent permit, and Recovery Mode", () => {
    expect(preSendCheck({ snapshot: { ...snapshot, bosNonce: 5n }, auth, permit, permitToken: "btc", now: 1_000n })?.kind).toBe("trove-auth-used");
    expect(preSendCheck({ snapshot, auth, permit, permitToken: "btc", now: 1_545n })?.kind).toBe("permit-expired");
    expect(preSendCheck({ snapshot: { ...snapshot, btcPermitNonce: 4n }, auth, permit, permitToken: "btc", now: 1_000n })?.kind).toBe("permit-expired");
    expect(preSendCheck({ snapshot: { ...snapshot, recoveryMode: true }, auth, permit, permitToken: "btc", now: 1_000n })?.kind).toBe("trove-recovery-mode");
  });
});

describe("quoteFor", () => {
  it("quotes each action from the snapshot and the intent", () => {
    const intent = { cr: 3n * ONE, btc: null, slippageBps: 100n };
    expect(quoteFor("unwind", snapshot, intent, networks.testnet)?.action).toBe("unwind");
    expect(quoteFor("close", snapshot, intent, networks.testnet)?.action).toBe("close");
    expect(quoteFor("leverage", snapshot, { ...intent, cr: 2n * ONE }, networks.testnet)?.action).toBe("leverage");
    const open = quoteFor("open", { ...snapshot, trove: null }, { cr: 2n * ONE, btc: ONE, slippageBps: 100n }, networks.testnet);
    expect(open?.action === "open" && open.btcFromUser).toBe(ONE);
  });

  it("is null without the input an action needs", () => {
    expect(quoteFor("unwind", snapshot, { cr: null, btc: null, slippageBps: 100n }, networks.testnet)).toBeNull();
    expect(quoteFor("close", { ...snapshot, trove: null }, { cr: null, btc: null, slippageBps: 100n }, networks.testnet)).toBeNull();
  });
});

describe("Leverage and Open survive the wait between signing and sending (review Critical 1)", () => {
  const aged = (t: { coll: bigint; debt: bigint }, price: bigint) => {
    // 600 s of interest at 5% a year, and a 0.25% oracle drop.
    const debt = t.debt + (t.debt * 500n * 600n) / (10_000n * 31_536_000n) + 1n;
    return (t.coll * ((price * 9_975n) / 10_000n)) / debt;
  };

  it("quotes Leverage above the target so the signed minimum still holds after 600 s and a 0.25% drop", () => {
    const q = quoteFor("leverage", snapshot, { cr: 2n * ONE, btc: null, slippageBps: 100n }, networks.testnet);
    expect(q?.action).toBe("leverage");
    const after = q!.action === "leverage" ? q!.quote.after : null;
    expect(aged(after!, HARNESS_MARKET.price) >= signedMinCr({ cr: 2n * ONE, btc: null, slippageBps: 100n })).toBe(true);
  });

  it("quotes Open the same way", () => {
    const q = quoteFor("open", { ...snapshot, trove: null }, { cr: 2n * ONE, btc: ONE, slippageBps: 100n }, networks.testnet);
    const after = q?.action === "open" ? q.quote!.after : null;
    expect(aged(after!, HARNESS_MARKET.price) >= 2n * ONE).toBe(true);
  });
});

describe("restartsSigning (review Important 1)", () => {
  it("sends the flow back to the authorisation after a used authorisation, a moved price, or an expiry", () => {
    expect(restartsSigning("trove-auth-used")).toBe(true);
    expect(restartsSigning("price-moved")).toBe(true);
    expect(restartsSigning("permit-expired")).toBe(true);
    expect(restartsSigning("rejected")).toBe(false);
    expect(restartsSigning("rpc-unavailable")).toBe(false);
  });
});
