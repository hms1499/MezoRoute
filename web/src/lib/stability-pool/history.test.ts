import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { networks } from "@/lib/config/networks";
import { parseExplorerResponse } from "./explorer";
import depositChanged from "./fixtures/e3b0-deposit-changed.json";
import gainWithdrawn from "./fixtures/e3b0-gain-withdrawn.json";
import { decodeSpLog, fetchSpHistoryRows, spActions, type SpEventRow } from "./history";

const ONE = 10n ** 18n;
const liveRows = () =>
  [...parseExplorerResponse(depositChanged), ...parseExplorerResponse(gainWithdrawn)]
    .map(decodeSpLog)
    .filter((row): row is SpEventRow => row !== null);

const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const changed = (t: number, block: bigint, logIndex: number, newDeposit: bigint): SpEventRow => ({
  kind: "deposit-changed",
  txHash: tx(t),
  blockNumber: block,
  logIndex,
  newDeposit,
});
const gained = (t: number, block: bigint, logIndex: number, collateral: bigint, musdLoss: bigint): SpEventRow => ({
  kind: "gain-withdrawn",
  txHash: tx(t),
  blockNumber: block,
  logIndex,
  collateral,
  musdLoss,
});

describe("decodeSpLog", () => {
  it("decodes the live UserDepositChanged and CollateralGainWithdrawn logs", () => {
    const rows = liveRows();
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({ kind: "deposit-changed", blockNumber: 14_973_621n, logIndex: 5, newDeposit: 25n * ONE });
    expect(rows.filter((row) => row.kind === "gain-withdrawn").every((row) => row.kind === "gain-withdrawn" && row.collateral === 0n)).toBe(true);
  });

  it("ignores a log of another event", () => {
    const other = { ...parseExplorerResponse(depositChanged)[0], topics: [tx(1)] };
    expect(decodeSpLog(other)).toBeNull();
  });
});

describe("spActions", () => {
  it("replays the live history: five deposits and two withdrawals, ending at 54 MUSD", () => {
    const actions = spActions(liveRows());
    expect(actions.map((action) => [action.kind, action.amount / ONE])).toEqual([
      ["deposit", 25n],
      ["deposit", 2n],
      ["withdraw", 1n],
      ["deposit", 5n],
      ["withdraw", 2n],
      ["deposit", 10n],
      ["deposit", 15n],
    ]);
    expect(actions.at(-1)?.depositAfter).toBe(54n * ONE);
  });

  it("measures a withdrawal against the deposit after its loss", () => {
    const actions = spActions([
      changed(1, 10n, 0, 100n * ONE),
      gained(1, 10n, 1, 0n, 0n),
      changed(2, 20n, 3, 40n * ONE),
      gained(2, 20n, 4, 5n, 20n * ONE),
    ]);
    expect(actions[1]).toMatchObject({ kind: "withdraw", before: 80n * ONE, amount: 40n * ONE, gain: 5n, loss: 20n * ONE });
  });

  it("reads an unchanged deposit as a claim", () => {
    const actions = spActions([changed(1, 10n, 0, 50n * ONE), gained(1, 10n, 1, 0n, 0n), changed(2, 20n, 0, 50n * ONE), gained(2, 20n, 1, 7n, 0n)]);
    expect(actions[1]).toMatchObject({ kind: "claim", amount: 0n, gain: 7n });
  });

  it("pairs a gain logged before its deposit change (withdrawCollateralGainToTrove)", () => {
    const actions = spActions([changed(1, 10n, 0, 50n * ONE), gained(1, 10n, 1, 0n, 0n), gained(2, 20n, 6, 9n, 0n), changed(2, 20n, 7, 50n * ONE)]);
    expect(actions[1]).toMatchObject({ kind: "claim", gain: 9n });
  });

  it("keeps two calls in one transaction apart", () => {
    const actions = spActions([changed(1, 10n, 1, 10n * ONE), gained(1, 10n, 2, 0n, 0n), changed(1, 10n, 5, 30n * ONE), gained(1, 10n, 6, 0n, 0n)]);
    expect(actions.map((action) => action.amount / ONE)).toEqual([10n, 20n]);
  });

  it("sorts rows that arrive out of order", () => {
    const actions = spActions([changed(2, 20n, 0, 30n * ONE), gained(2, 20n, 1, 0n, 0n), changed(1, 10n, 0, 10n * ONE), gained(1, 10n, 1, 0n, 0n)]);
    expect(actions.map((action) => action.amount / ONE)).toEqual([10n, 20n]);
  });
});

describe("fetchSpHistoryRows", () => {
  it("asks for both events of the padded, lower-case account on the network's API", async () => {
    const fetchJson = vi.fn().mockImplementation(async (url: string) =>
      url.includes("topic0=0xbce7") ? depositChanged : gainWithdrawn,
    );
    const rows = await fetchSpHistoryRows(fetchJson, networks.testnet, "0xE3B02B215085B99CE61E0F5EA9763AC637AA7826");
    expect(rows).toHaveLength(14);
    for (const [url] of fetchJson.mock.calls) {
      expect(url).toContain("https://api.explorer.test.mezo.org/api?");
      expect(url).toContain("topic1=0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826");
    }
  });
});
