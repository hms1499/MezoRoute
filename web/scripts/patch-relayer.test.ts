import { describe, expect, it } from "vitest";
import { DEAD_RELAYER, LIVE_RELAYER, patchRelayerSource } from "./patch-relayer.mjs";

const original = [
  'relayEndpoint ?? "https://test.mezo.org/api/v2/relay/transactions";',
  'new MezoTransactionSender(chainId, "https://test.mezo.org/api/v2/relay/deploy-safe", r);',
  'http: ["https://rpc.test.mezo.org"],',
].join("\n");

describe("patchRelayerSource", () => {
  it("rewrites both relay endpoints and leaves the RPC URL alone", () => {
    const { status, source } = patchRelayerSource(original);
    expect(status).toBe("patched");
    expect(source).toContain(`${LIVE_RELAYER}transactions`);
    expect(source).toContain(`${LIVE_RELAYER}deploy-safe`);
    expect(source).not.toContain(DEAD_RELAYER);
    expect(source).toContain("https://rpc.test.mezo.org");
  });

  it("is idempotent", () => {
    const once = patchRelayerSource(original).source;
    expect(patchRelayerSource(once)).toEqual({ status: "already-patched", source: once });
  });

  it("reports files that contain neither URL", () => {
    expect(patchRelayerSource('http: ["https://rpc.test.mezo.org"]').status).toBe("not-found");
  });
});
