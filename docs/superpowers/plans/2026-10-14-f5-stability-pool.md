# F5 Stability Pool Route, Position, and Withdraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user deposits wallet MUSD into the MUSD Stability Pool (`/route/stability-pool/` → `/confirm/`), sees the compounded deposit, pending BTC gain, cost basis, and estimated value change on `/positions/`, claims the BTC gain (`withdrawFromSP(0)`), and withdraws 25/50/75/Max (`/positions/stability-pool/withdraw/`); receipts decode the pool's events.

**Architecture:** Pure, unit-tested core in `web/src/lib/stability-pool/` (explorer log reader, history → actions, cost basis, snapshot, gates, steps, calls, previews, receipt). One multicall snapshot per page (the dashboard's 12 reads plus `deposits`, the MUSD allowance to the pool, and the block number). History comes from the explorer's Blockscout API (`api.explorer.test.mezo.org` / `api.explorer.mezo.org`), two requests per account, no cache, checked against `deposits(account)` for indexer lag. All calls go straight to the StabilityPool (no executor, no fee).

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, wagmi 2.19.5, viem 2.57.2, `@mezo-org/passport` 0.17.2, TanStack Query (via wagmi), Vitest 5, TypeScript 5.9.

**Spec:** `docs/superpowers/specs/2026-10-14-f5-stability-pool-design.md` (read it first; chain facts verified 14 Oct 2026). F3 (`2026-10-05-f3-lp-route-design.md`) and F7 (`2026-10-12-f7-lp-positions-design.md`) code is the pattern to mirror.

## Global Constraints

- Branch `feat/f5-stability-pool` in `/Users/vanhuy/Desktop/mezoroute`; no worktree. Run `git branch --show-current` before each commit; stage explicit paths; no `* 2*` iCloud duplicates in `git status`.
- Commit prefixes `feat(web):`, `fix(web):`, `test(web):`, `docs:`; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency changes, no contract changes. Addresses only from `network.addresses`; the explorer API only from `network.explorerApiUrl`.
- All amounts are `bigint` (1e18 = 1 MUSD / 1 BTC). Copy in English; never "profit", "APY", "guaranteed", "risk-free"; pre-transaction values are "estimated"; the cost-basis difference is "Estimated position value change".
- No MezoRoute fee on any Stability Pool action (FR-18); copy says "No MezoRoute fee".
- Every write goes through `writeBlocker` (mainnet stays read-only until M1). No mainnet cap on SP actions (the cap belongs to the executor).
- Every send passes a gas budget to `submitCall(config, call, pin, gasBudget)`; sends are simulated first.
- viem's `decodeEventLog` ignores `eventName` at runtime: always check `decoded.eventName`.
- TanStack Query keys must not contain `bigint` (JSON hashing throws): use `.toString()`.
- Never let `WagmiProvider` re-render (CLAUDE.md); new pages load their component with `next/dynamic` and `ssr: false`, like `web/src/app/positions/lp/exit/page.tsx`.
- Run `npm` from `web/`. UI tasks also run `npm run build` (lint + type check). Never build while `npm run dev` runs. The repo does not use prettier.

## Review Focus

- **The explorer lags the chain** right after a deposit or withdrawal: history must not show a cost basis for an older deposit. Pinned in Task 3 (`historyLagging` true when `lastDeposit ≠ deposits(account)`) and Task 3 (`historyStatus` reports `updating` for a lag failure).
- **Withdrawing after the deposit absorbed a loss**: a plain "deposits − withdrawals" basis goes wrong. Pinned in Task 3 (deposit 100, loss 20, withdraw 40 of 80 → basis 50).
- **A zero BTC gain or no deposit must not send a pointless `withdrawFromSP(0)`**. Pinned in Task 4 (`spClaimBlock` reasons `no-deposit`, `no-gain`).
- **Max withdraw leaves no dust**: Max is the exact compounded deposit. Pinned in Task 4 (`spWithdrawPreview` at 100% = compounded, deposit after 0).
- **Blockscout's 1,000-log page limit** would silently truncate a long history. Pinned in Task 2 (`fetchAllLogs` pages from the last block and de-duplicates; a page stuck in one block throws).

---

### Task 1: Config, ABI, outcomes, and revert strings

**Files:**
- Modify: `web/src/lib/config/networks.ts`
- Modify: `web/src/lib/abi/musd.ts`
- Modify: `web/src/lib/errors/types.ts`
- Modify: `web/src/lib/errors/outcomes.ts`
- Modify: `web/src/lib/errors/revert-strings.ts`
- Test: `web/src/lib/errors/revert-strings.test.ts`

**Interfaces:**
- Produces:
  - `NetworkConfig.explorerApiUrl: string` (testnet `https://api.explorer.test.mezo.org`, mainnet `https://api.explorer.mezo.org`)
  - `stabilityPoolAbi` gains `deposits(address) view returns (uint256)`, `provideToSP(uint256)`, `withdrawFromSP(uint256)`, `event UserDepositChanged(address indexed depositor, uint256 newDeposit)`, `event CollateralGainWithdrawn(address indexed depositor, uint256 collateral, uint256 MUSDLoss)`
  - `ErrorKind` gains `"sp-withdraw-blocked" | "no-sp-deposit"`
  - Outcomes `SP_WITHDRAW_BLOCKED`, `NO_SP_DEPOSIT`, `NO_SP_GAIN` (kind `"nothing-to-claim"`)

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/errors/revert-strings.test.ts`:

```ts
describe("revertStringOutcome: StabilityPool (F5)", () => {
  it.each([
    ["StabilityPool: Cannot withdraw while there are troves with ICR < MCR", "sp-withdraw-blocked"],
    ["StabilityPool: User must have a non-zero deposit", "no-sp-deposit"],
    ["StabilityPool: Amount must be non-zero", "amount-too-small"],
  ])("maps %j", (reason, kind) => {
    expect(revertStringOutcome(reason)?.kind).toBe(kind);
  });

  it("does not mistake the blocked withdrawal for a Trove CR revert", () => {
    expect(revertStringOutcome("StabilityPool: Cannot withdraw while there are troves with ICR < MCR")?.kind).not.toBe("cr-floor");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/errors/revert-strings.test.ts`
Expected: FAIL (the three new rows return `undefined`).

- [ ] **Step 3: Implement**

`web/src/lib/errors/types.ts`: add to `ErrorKind`, after `"nothing-to-claim"`:

```ts
  | "sp-withdraw-blocked"
  | "no-sp-deposit"
```

`web/src/lib/errors/outcomes.ts`: add after `NOTHING_TO_CLAIM`:

```ts
// Stability Pool (F5); the blocked-withdrawal message is PRODUCT_SPEC §13's.
export const SP_WITHDRAW_BLOCKED: Outcome = {
  kind: "sp-withdraw-blocked",
  message: "Withdrawals are paused while some Troves are under-collateralised.",
  recovery: ["retry"],
};

export const NO_SP_DEPOSIT: Outcome = { kind: "no-sp-deposit", message: "You have no Stability Pool deposit.", recovery: [] };

export const NO_SP_GAIN: Outcome = { kind: "nothing-to-claim", message: "You have no BTC gain to claim yet.", recovery: [] };
```

`web/src/lib/errors/revert-strings.ts`: import `NO_SP_DEPOSIT`, `SP_WITHDRAW_BLOCKED`, and `AMOUNT_TOO_SMALL` from `./outcomes`; change the doc comment's last sentence to "F5 added the Stability Pool rows."; insert the rows **before** the `/would result in ICR < MCR/` row:

```ts
  // StabilityPool (F5): withdrawFromSP / provideToSP.
  { match: /Cannot withdraw while there are troves with ICR < MCR/i, outcome: SP_WITHDRAW_BLOCKED },
  { match: /User must have a non-zero deposit/i, outcome: NO_SP_DEPOSIT },
  { match: /StabilityPool: Amount must be non-zero/i, outcome: AMOUNT_TOO_SMALL },
```

`web/src/lib/abi/musd.ts`: replace `stabilityPoolAbi` with:

```ts
/** StabilityPool (mezo-org/musd `StabilityPool.sol`); deposits and withdrawals act only for msg.sender. */
export const stabilityPoolAbi = parseAbi([
  "function getCompoundedMUSDDeposit(address depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address depositor) view returns (uint256)",
  "function deposits(address depositor) view returns (uint256)",
  "function provideToSP(uint256 amount)",
  "function withdrawFromSP(uint256 amount)",
  "event UserDepositChanged(address indexed depositor, uint256 newDeposit)",
  "event CollateralGainWithdrawn(address indexed depositor, uint256 collateral, uint256 MUSDLoss)",
]);
```

`web/src/lib/config/networks.ts`: in `NetworkConfig`, after `explorerUrl: string;` add

```ts
  /** The explorer's Blockscout API (F5 reads Stability Pool history from it; the frontend host serves no API). */
  explorerApiUrl: string;
```

and set `explorerApiUrl: "https://api.explorer.test.mezo.org",` (testnet) and `explorerApiUrl: "https://api.explorer.mezo.org",` (mainnet) right after each `explorerUrl`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/errors && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/config/networks.ts web/src/lib/abi/musd.ts web/src/lib/errors/types.ts web/src/lib/errors/outcomes.ts web/src/lib/errors/revert-strings.ts web/src/lib/errors/revert-strings.test.ts
git commit -m "feat(web): add Stability Pool ABI, explorer API URL, and SP error outcomes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Explorer log reader and history actions

**Files:**
- Create: `web/src/lib/stability-pool/explorer.ts`
- Create: `web/src/lib/stability-pool/history.ts`
- Create: `web/src/lib/stability-pool/fixtures/e3b0-deposit-changed.json`
- Create: `web/src/lib/stability-pool/fixtures/e3b0-gain-withdrawn.json`
- Test: `web/src/lib/stability-pool/explorer.test.ts`
- Test: `web/src/lib/stability-pool/history.test.ts`

**Interfaces:**
- Consumes: `stabilityPoolAbi` (Task 1), `NetworkConfig.explorerApiUrl` (Task 1).
- Produces:
  - `type ExplorerLog = { blockNumber: string; logIndex: string; transactionHash: Hex; topics: (Hex | null)[]; data: Hex }`
  - `class ExplorerError extends Error`
  - `EXPLORER_PAGE = 1_000`, `EXPLORER_TIMEOUT_MS = 10_000`
  - `parseExplorerResponse(json: unknown): ExplorerLog[]`
  - `explorerLogsUrl(apiUrl: string, query: LogQuery & { fromBlock: bigint }): string` with `type LogQuery = { address: Address; topic0: Hex; topic1: Hex }`
  - `type FetchJson = (url: string) => Promise<unknown>`; `browserFetchJson: FetchJson`
  - `fetchAllLogs(fetchJson: FetchJson, apiUrl: string, query: LogQuery): Promise<ExplorerLog[]>`
  - `type SpEventRow` (union below), `decodeSpLog(log: ExplorerLog): SpEventRow | null`
  - `type SpAction = { kind: "deposit" | "withdraw" | "claim"; txHash: Hex; blockNumber: bigint; amount: bigint; gain: bigint; loss: bigint; before: bigint; depositAfter: bigint }`
  - `spActions(rows: SpEventRow[]): SpAction[]`
  - `fetchSpHistoryRows(fetchJson: FetchJson, network: NetworkConfig, account: Address): Promise<SpEventRow[]>`

- [ ] **Step 1: Save the live fixtures**

Historical logs of depositor `0xe3b0…7826` (deposits 25 → 27 → 26 → 31 → 29 → 39 → 54 MUSD, blocks 14,973,621–15,439,988); they never change:

```bash
mkdir -p web/src/lib/stability-pool/fixtures
A="https://api.explorer.test.mezo.org/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=0x1CCA7E410eE41739792eA0A24e00349Dd247680e&topic1=0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826&topic0_1_opr=and"
curl -s -A "Mozilla/5.0" "$A&topic0=0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9" > web/src/lib/stability-pool/fixtures/e3b0-deposit-changed.json
curl -s -A "Mozilla/5.0" "$A&topic0=0x47647c495a7db9471a1b024b3c6f7555a502a0de4b130d83a4d3c8f9cff25939" > web/src/lib/stability-pool/fixtures/e3b0-gain-withdrawn.json
grep -o '"blockNumber"' web/src/lib/stability-pool/fixtures/e3b0-deposit-changed.json | wc -l
```

Expected: `7` (and 7 in the other file). Both files start with `{"message":"OK"`.

- [ ] **Step 2: Write the failing explorer tests**

Create `web/src/lib/stability-pool/explorer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { EXPLORER_PAGE, ExplorerError, explorerLogsUrl, fetchAllLogs, parseExplorerResponse, type ExplorerLog } from "./explorer";
import depositChanged from "./fixtures/e3b0-deposit-changed.json";

const SP = "0x1CCA7E410eE41739792eA0A24e00349Dd247680e";
const QUERY = {
  address: SP,
  topic0: "0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9",
  topic1: "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826",
} as const;

function log(block: number, index: number): ExplorerLog {
  return {
    blockNumber: `0x${block.toString(16)}`,
    logIndex: `0x${index.toString(16)}`,
    transactionHash: `0x${block.toString(16).padStart(32, "0")}${index.toString(16).padStart(32, "0")}`,
    topics: [QUERY.topic0, QUERY.topic1, null, null],
    data: "0x",
  };
}

describe("parseExplorerResponse", () => {
  it("returns the logs of an OK response", () => {
    expect(parseExplorerResponse(depositChanged)).toHaveLength(7);
  });

  it("treats Blockscout's 'No logs found' as an empty history", () => {
    expect(parseExplorerResponse({ message: "No logs found", result: [], status: "0" })).toEqual([]);
  });

  it.each([[{ message: "Invalid fromBlock format", result: null, status: "0" }], [null], ["<html>"]])("rejects %j", (json) => {
    expect(() => parseExplorerResponse(json)).toThrow(ExplorerError);
  });
});

describe("explorerLogsUrl", () => {
  it("asks for one event of one depositor from a block", () => {
    const url = new URL(explorerLogsUrl("https://api.explorer.test.mezo.org", { ...QUERY, fromBlock: 15_000_000n }));
    expect(url.origin + url.pathname).toBe("https://api.explorer.test.mezo.org/api");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      module: "logs",
      action: "getLogs",
      fromBlock: "15000000",
      toBlock: "latest",
      address: SP,
      topic0: QUERY.topic0,
      topic1: QUERY.topic1,
      topic0_1_opr: "and",
    });
  });
});

describe("fetchAllLogs", () => {
  it("makes one request when the page is not full", async () => {
    const fetchJson = vi.fn().mockResolvedValue(depositChanged);
    expect(await fetchAllLogs(fetchJson, "https://x", QUERY)).toHaveLength(7);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("pages from the last block of a full page and drops duplicates", async () => {
    const first = Array.from({ length: EXPLORER_PAGE }, (_, i) => log(100 + Math.floor(i / 2), i % 2));
    const lastBlock = 100 + Math.floor((EXPLORER_PAGE - 1) / 2);
    const second = [log(lastBlock, 1), log(lastBlock + 1, 0)];
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({ message: "OK", result: first, status: "1" })
      .mockResolvedValueOnce({ message: "OK", result: second, status: "1" });
    const logs = await fetchAllLogs(fetchJson, "https://x", QUERY);
    expect(logs).toHaveLength(EXPLORER_PAGE + 1);
    expect(new URL(fetchJson.mock.calls[1][0]).searchParams.get("fromBlock")).toBe(lastBlock.toString());
  });

  it("throws instead of looping when one block holds a full page", async () => {
    const full = Array.from({ length: EXPLORER_PAGE }, (_, i) => log(0, i));
    const fetchJson = vi.fn().mockResolvedValue({ message: "OK", result: full, status: "1" });
    await expect(fetchAllLogs(fetchJson, "https://x", QUERY)).rejects.toThrow(ExplorerError);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd web && npx vitest run src/lib/stability-pool/explorer.test.ts`
Expected: FAIL (module `./explorer` not found).

- [ ] **Step 4: Implement `explorer.ts`**

Create `web/src/lib/stability-pool/explorer.ts`:

```ts
import type { Address, Hex } from "viem";

/**
 * One log as Blockscout's etherscan-style `getLogs` returns it: hex strings, and `null` for unused
 * topic slots. The explorer frontend serves no API; `NetworkConfig.explorerApiUrl` is its backend.
 */
export type ExplorerLog = { blockNumber: string; logIndex: string; transactionHash: Hex; topics: (Hex | null)[]; data: Hex };

/** Blockscout returns at most this many logs per request. */
export const EXPLORER_PAGE = 1_000;
export const EXPLORER_TIMEOUT_MS = 10_000;

export class ExplorerError extends Error {
  override name = "ExplorerError";
}

export type LogQuery = { address: Address; topic0: Hex; topic1: Hex };
export type FetchJson = (url: string) => Promise<unknown>;

/** The logs of an OK response; "No logs found" is an empty history; anything else is an error. */
export function parseExplorerResponse(json: unknown): ExplorerLog[] {
  if (typeof json !== "object" || json === null) throw new ExplorerError("Malformed explorer response");
  const { message, result } = json as { message?: unknown; result?: unknown };
  if (message === "No logs found") return [];
  if (message !== "OK" || !Array.isArray(result)) throw new ExplorerError(`Explorer error: ${String(message)}`);
  return result as ExplorerLog[];
}

export function explorerLogsUrl(apiUrl: string, query: LogQuery & { fromBlock: bigint }): string {
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: query.fromBlock.toString(),
    toBlock: "latest",
    address: query.address,
    topic0: query.topic0,
    topic1: query.topic1,
    topic0_1_opr: "and",
  });
  return `${apiUrl}/api?${params.toString()}`;
}

/**
 * Every log of one event for one indexed topic1. A full page continues from its last block (that
 * block is asked for again, so logs are de-duplicated by transaction and index); a full page inside
 * one block cannot advance and throws rather than loop.
 */
export async function fetchAllLogs(fetchJson: FetchJson, apiUrl: string, query: LogQuery): Promise<ExplorerLog[]> {
  const logs = new Map<string, ExplorerLog>();
  let fromBlock = 0n;
  for (;;) {
    const page = parseExplorerResponse(await fetchJson(explorerLogsUrl(apiUrl, { ...query, fromBlock })));
    for (const log of page) logs.set(`${log.transactionHash}:${log.logIndex}`, log);
    if (page.length < EXPLORER_PAGE) return [...logs.values()];
    const last = BigInt(page[page.length - 1].blockNumber);
    if (last <= fromBlock) throw new ExplorerError("Explorer page did not advance");
    fromBlock = last;
  }
}

export const browserFetchJson: FetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(EXPLORER_TIMEOUT_MS) });
  if (!response.ok) throw new ExplorerError(`Explorer HTTP ${response.status}`);
  return response.json();
};
```

- [ ] **Step 5: Run the explorer tests**

Run: `cd web && npx vitest run src/lib/stability-pool/explorer.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing history tests**

Create `web/src/lib/stability-pool/history.test.ts`:

```ts
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
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd web && npx vitest run src/lib/stability-pool/history.test.ts`
Expected: FAIL (module `./history` not found).

- [ ] **Step 8: Implement `history.ts`**

Create `web/src/lib/stability-pool/history.ts`:

```ts
import { decodeEventLog, getAbiItem, pad, toEventSelector, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { fetchAllLogs, type ExplorerLog, type FetchJson } from "./explorer";

type RowBase = { txHash: Hex; blockNumber: bigint; logIndex: number };
export type SpEventRow =
  | (RowBase & { kind: "deposit-changed"; newDeposit: bigint })
  | (RowBase & { kind: "gain-withdrawn"; collateral: bigint; musdLoss: bigint });

/**
 * One Stability Pool action of the depositor, rebuilt from its events: `before` is the compounded
 * deposit just before it (`previous newDeposit − MUSDLoss`), `amount` the MUSD added or removed.
 * An unchanged deposit is a claim (`withdrawFromSP(0)` or moving the gain to the Trove).
 */
export type SpAction = {
  kind: "deposit" | "withdraw" | "claim";
  txHash: Hex;
  blockNumber: bigint;
  amount: bigint;
  gain: bigint; // BTC paid out by this action
  loss: bigint; // MUSD the deposit had absorbed since the previous action
  before: bigint;
  depositAfter: bigint;
};

export const DEPOSIT_CHANGED_TOPIC = toEventSelector(getAbiItem({ abi: stabilityPoolAbi, name: "UserDepositChanged" }));
export const GAIN_WITHDRAWN_TOPIC = toEventSelector(getAbiItem({ abi: stabilityPoolAbi, name: "CollateralGainWithdrawn" }));

const toBigInt = (hex: string) => (hex === "0x" ? 0n : BigInt(hex));

export function decodeSpLog(log: ExplorerLog): SpEventRow | null {
  const topics = log.topics.filter((topic): topic is Hex => topic !== null);
  if (topics.length === 0) return null;
  const base = { txHash: log.transactionHash, blockNumber: toBigInt(log.blockNumber), logIndex: Number(toBigInt(log.logIndex)) };
  try {
    // decodeEventLog matches whichever ABI event the topic names, so check the name.
    const decoded = decodeEventLog({ abi: stabilityPoolAbi, topics: topics as [Hex, ...Hex[]], data: log.data });
    if (decoded.eventName === "UserDepositChanged") return { ...base, kind: "deposit-changed", newDeposit: decoded.args.newDeposit };
    if (decoded.eventName === "CollateralGainWithdrawn") {
      return { ...base, kind: "gain-withdrawn", collateral: decoded.args.collateral, musdLoss: decoded.args.MUSDLoss };
    }
    return null;
  } catch {
    return null;
  }
}

const chainOrder = (a: SpEventRow, b: SpEventRow) =>
  a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1;

/**
 * Actions in chain order. Each `UserDepositChanged` pairs with the `CollateralGainWithdrawn` logged
 * right next to it in the same transaction: after it for provideToSP/withdrawFromSP, before it for
 * withdrawCollateralGainToTrove. Pairing by adjacency keeps two calls in one transaction apart.
 */
export function spActions(rows: SpEventRow[]): SpAction[] {
  const sorted = [...rows].sort(chainOrder);
  const gains = sorted.filter((row): row is Extract<SpEventRow, { kind: "gain-withdrawn" }> => row.kind === "gain-withdrawn");
  let previous = 0n;
  const actions: SpAction[] = [];
  for (const row of sorted) {
    if (row.kind !== "deposit-changed") continue;
    const pair = gains.find(
      (gain) => gain.txHash.toLowerCase() === row.txHash.toLowerCase() && Math.abs(gain.logIndex - row.logIndex) === 1,
    );
    const loss = pair?.musdLoss ?? 0n;
    const before = previous > loss ? previous - loss : 0n;
    const delta = row.newDeposit - before;
    actions.push({
      kind: delta > 0n ? "deposit" : delta < 0n ? "withdraw" : "claim",
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      amount: delta < 0n ? -delta : delta,
      gain: pair?.collateral ?? 0n,
      loss,
      before,
      depositAfter: row.newDeposit,
    });
    previous = row.newDeposit;
  }
  return actions;
}

/** Both events of one depositor from the network's explorer API (two requests, paged if needed). */
export async function fetchSpHistoryRows(fetchJson: FetchJson, network: NetworkConfig, account: Address): Promise<SpEventRow[]> {
  const topic1 = pad(account.toLowerCase() as Address, { size: 32 });
  const address = network.addresses.stabilityPool;
  const [changed, gained] = await Promise.all([
    fetchAllLogs(fetchJson, network.explorerApiUrl, { address, topic0: DEPOSIT_CHANGED_TOPIC, topic1 }),
    fetchAllLogs(fetchJson, network.explorerApiUrl, { address, topic0: GAIN_WITHDRAWN_TOPIC, topic1 }),
  ]);
  return [...changed, ...gained].map(decodeSpLog).filter((row): row is SpEventRow => row !== null);
}
```

- [ ] **Step 9: Run the tests**

Run: `cd web && npx vitest run src/lib/stability-pool`
Expected: PASS. (`DEPOSIT_CHANGED_TOPIC` must equal `0xbce78369…11c9`; the fetch test's `url.includes("topic0=0xbce7")` depends on it.)

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/stability-pool/explorer.ts web/src/lib/stability-pool/explorer.test.ts web/src/lib/stability-pool/history.ts web/src/lib/stability-pool/history.test.ts web/src/lib/stability-pool/fixtures
git commit -m "feat(web): read Stability Pool history from the explorer API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cost basis, history status, and the snapshot

**Files:**
- Create: `web/src/lib/stability-pool/cost-basis.ts`
- Create: `web/src/lib/stability-pool/snapshot.ts`
- Create: `web/src/lib/stability-pool/position.ts`
- Create: `web/src/lib/stability-pool/test-fixtures.ts`
- Test: `web/src/lib/stability-pool/cost-basis.test.ts`
- Test: `web/src/lib/stability-pool/snapshot.test.ts`
- Test: `web/src/lib/stability-pool/position.test.ts`

**Interfaces:**
- Consumes: `SpAction` (Task 2); `snapshotContracts`, `parseSnapshot`, `SnapshotResults`, `DashboardSnapshot` (`@/lib/dashboard/snapshot`); `DASHBOARD_READS` (`@/lib/routes/musd-btc-lp/snapshot`); `multicall3BlockAbi`; `snapshotWith`, `ONE`, `FIXTURE_PRICE` (`@/lib/dashboard/test-fixtures`).
- Produces:
  - `type SpCostBasis = { basis: bigint; gainsClaimed: bigint; lossRealised: bigint; lastDeposit: bigint }`; `spCostBasis(actions: SpAction[]): SpCostBasis`
  - `historyLagging(basis: SpCostBasis, initialDeposit: bigint): boolean`
  - `class HistoryLagError extends Error`
  - `type HistoryStatus = "loading" | "updating" | "ready" | "unavailable"`; `historyStatus(input: { hasData: boolean; error: unknown; failureReason: unknown }): HistoryStatus`
  - `type SpSnapshot = { dashboard: DashboardSnapshot; initialDeposit: bigint; allowance: bigint; blockNumber: bigint }`
  - `type SpData = { snapshot: SpSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number }`
  - `type SpResults`; `spContracts(network: NetworkConfig, account: Address)`; `parseSpSnapshot(network: NetworkConfig, results: SpResults): SpSnapshot`
  - `type SpView = { deposit: bigint; gain: bigint; gainValue: bigint; value: bigint; empty: boolean; cost: SpCostView | null }`, `type SpCostView = { basis: bigint; valueChange: bigint; gainsClaimed: bigint; absorbed: bigint }`; `spView(snapshot: SpSnapshot, basis: SpCostBasis | null): SpView`
  - Test fixtures `spSnapshotWith(overrides?: Partial<SpSnapshot>): SpSnapshot`, `spDataWith(overrides?: Partial<SpData>): SpData`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/stability-pool/cost-basis.test.ts`:

```ts
import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { HistoryLagError, historyLagging, historyStatus, spCostBasis } from "./cost-basis";
import type { SpAction } from "./history";

const ONE = 10n ** 18n;
const action = (kind: SpAction["kind"], amount: bigint, before: bigint, depositAfter: bigint, gain = 0n, loss = 0n): SpAction => ({
  kind,
  txHash: "0x01" as Hex,
  blockNumber: 1n,
  amount,
  gain,
  loss,
  before,
  depositAfter,
});

describe("spCostBasis", () => {
  it("is zero without history", () => {
    expect(spCostBasis([])).toEqual({ basis: 0n, gainsClaimed: 0n, lossRealised: 0n, lastDeposit: 0n });
  });

  it("adds deposits", () => {
    expect(spCostBasis([action("deposit", 25n * ONE, 0n, 25n * ONE), action("deposit", 5n * ONE, 25n * ONE, 30n * ONE)]).basis).toBe(30n * ONE);
  });

  it("removes cost pro rata after the deposit absorbed a loss", () => {
    const result = spCostBasis([
      action("deposit", 100n * ONE, 0n, 100n * ONE),
      action("withdraw", 40n * ONE, 80n * ONE, 40n * ONE, 5n, 20n * ONE),
    ]);
    expect(result).toEqual({ basis: 50n * ONE, gainsClaimed: 5n, lossRealised: 20n * ONE, lastDeposit: 40n * ONE });
  });

  it("clears the basis on a full withdrawal", () => {
    expect(spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE), action("withdraw", 10n * ONE, 10n * ONE, 0n)]).basis).toBe(0n);
  });

  it("keeps the basis on a claim and counts the gain", () => {
    const result = spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE), action("claim", 0n, 10n * ONE, 10n * ONE, 3n)]);
    expect(result.basis).toBe(10n * ONE);
    expect(result.gainsClaimed).toBe(3n);
  });
});

describe("historyLagging", () => {
  it("flags history whose last deposit is not the on-chain deposit", () => {
    const basis = spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE)]);
    expect(historyLagging(basis, 10n * ONE)).toBe(false);
    expect(historyLagging(basis, 25n * ONE)).toBe(true);
  });

  it("accepts an empty history for an account that never deposited", () => {
    expect(historyLagging(spCostBasis([]), 0n)).toBe(false);
  });
});

describe("historyStatus", () => {
  it.each([
    [{ hasData: true, error: null, failureReason: null }, "ready"],
    [{ hasData: false, error: new Error("x"), failureReason: new Error("x") }, "unavailable"],
    [{ hasData: false, error: null, failureReason: new HistoryLagError("lag") }, "updating"],
    [{ hasData: false, error: null, failureReason: null }, "loading"],
  ] as const)("%j → %s", (input, status) => {
    expect(historyStatus(input)).toBe(status);
  });
});
```

Create `web/src/lib/stability-pool/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { SnapshotResults } from "@/lib/dashboard/snapshot";
import { parseSpSnapshot, spContracts, type SpResults } from "./snapshot";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
const ONE = 10n ** 18n;

const dashboardResults: SnapshotResults = [
  86_000n * ONE,
  1_100_000_000_000_000_000n,
  1_000_000_000_000_000n,
  0,
  [0n, 0n, 0n, 0n, 0n, 0n],
  0n,
  500n * ONE,
  0n,
  1_000n * ONE,
  [100n * ONE, 1n * ONE, 0n],
  40n * ONE,
  7n,
];

describe("spContracts", () => {
  it("reads the dashboard, the initial deposit, the MUSD allowance to the pool, and the block, on the selected chain", () => {
    const contracts = spContracts(networks.testnet, ACCOUNT);
    expect(contracts).toHaveLength(15);
    expect(contracts.every((call) => call.chainId === 31611)).toBe(true);
    expect(contracts[12]).toMatchObject({ address: networks.testnet.addresses.stabilityPool, functionName: "deposits", args: [ACCOUNT] });
    expect(contracts[13]).toMatchObject({
      address: networks.testnet.addresses.musd,
      functionName: "allowance",
      args: [ACCOUNT, networks.testnet.addresses.stabilityPool],
    });
    expect(contracts[14]).toMatchObject({ functionName: "getBlockNumber" });
  });
});

describe("parseSpSnapshot", () => {
  it("splits the dashboard part from the Stability Pool tail", () => {
    const results: SpResults = [...dashboardResults, 50n * ONE, 3n * ONE, 16_000_000n];
    const snapshot = parseSpSnapshot(networks.testnet, results);
    expect(snapshot.dashboard.sp).toEqual({ deposit: 40n * ONE, btcGain: 7n });
    expect(snapshot.dashboard.musd).toBe(500n * ONE);
    expect(snapshot).toMatchObject({ initialDeposit: 50n * ONE, allowance: 3n * ONE, blockNumber: 16_000_000n });
  });
});
```

Create `web/src/lib/stability-pool/position.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FIXTURE_PRICE, ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { WAD } from "@/lib/math";
import { spView } from "./position";
import { spSnapshotWith } from "./test-fixtures";

describe("spView", () => {
  const snapshot = spSnapshotWith({
    dashboard: snapshotWith({ sp: { deposit: 40n * ONE, btcGain: 1_000_000_000_000_000n } }),
    initialDeposit: 50n * ONE,
  });

  it("values the compounded deposit plus the pending gain at the price feed", () => {
    const view = spView(snapshot, null);
    const gainValue = (1_000_000_000_000_000n * FIXTURE_PRICE) / WAD;
    expect(view).toMatchObject({ deposit: 40n * ONE, gain: 1_000_000_000_000_000n, gainValue, value: 40n * ONE + gainValue, empty: false, cost: null });
  });

  it("adds the cost rows once the history is in: value change and everything absorbed", () => {
    const view = spView(snapshot, { basis: 60n * ONE, gainsClaimed: 2n, lossRealised: 5n * ONE, lastDeposit: 50n * ONE });
    expect(view.cost).toEqual({
      basis: 60n * ONE,
      valueChange: view.value - 60n * ONE,
      gainsClaimed: 2n,
      absorbed: 5n * ONE + 10n * ONE, // realised before + pending since the last action (50 − 40)
    });
  });

  it("is empty without an initial deposit", () => {
    expect(spView(spSnapshotWith(), null).empty).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/lib/stability-pool`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

Create `web/src/lib/stability-pool/cost-basis.ts`:

```ts
import type { SpAction } from "./history";

/**
 * MUSD cost of the current Stability Pool deposit (spec §12): deposits add their amount; a withdrawal
 * removes cost pro rata to the share of the compounded deposit it takes (`basis × amount / before`),
 * the rule LP exits use. A plain "deposits − withdrawals" sum goes wrong once the deposit has absorbed
 * liquidated debt. `lastDeposit` must equal `deposits(account)`, or the explorer is behind the chain.
 */
export type SpCostBasis = { basis: bigint; gainsClaimed: bigint; lossRealised: bigint; lastDeposit: bigint };

export function spCostBasis(actions: SpAction[]): SpCostBasis {
  let basis = 0n;
  let gainsClaimed = 0n;
  let lossRealised = 0n;
  let lastDeposit = 0n;
  for (const action of actions) {
    gainsClaimed += action.gain;
    lossRealised += action.loss;
    if (action.kind === "deposit") basis += action.amount;
    else if (action.kind === "withdraw") basis -= action.before === 0n ? basis : (basis * action.amount) / action.before;
    lastDeposit = action.depositAfter;
  }
  return { basis, gainsClaimed, lossRealised, lastDeposit };
}

export function historyLagging(basis: SpCostBasis, initialDeposit: bigint): boolean {
  return basis.lastDeposit !== initialDeposit;
}

/** The explorer has not indexed the latest action yet; the history query retries on it. */
export class HistoryLagError extends Error {
  override name = "HistoryLagError";
}

export type HistoryStatus = "loading" | "updating" | "ready" | "unavailable";

/** The cost-basis rows' state from the history query: lag retries show "Updating…", not an error. */
export function historyStatus(input: { hasData: boolean; error: unknown; failureReason: unknown }): HistoryStatus {
  if (input.hasData) return "ready";
  if (input.error) return "unavailable";
  if (input.failureReason instanceof HistoryLagError) return "updating";
  return "loading";
}
```

Create `web/src/lib/stability-pool/snapshot.ts`:

```ts
import { erc20Abi, type Address } from "viem";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
import { DASHBOARD_READS } from "@/lib/routes/musd-btc-lp/snapshot";

/**
 * Everything the Stability Pool pages read, from one block. The compounded deposit and pending BTC
 * gain are `dashboard.sp`; `initialDeposit` is `deposits(account)` (the deposit at the last action).
 */
export type SpSnapshot = {
  dashboard: DashboardSnapshot;
  initialDeposit: bigint;
  allowance: bigint; // MUSD the Stability Pool may already pull
  blockNumber: bigint;
};

export type SpData = { snapshot: SpSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

type SpTail = readonly [initialDeposit: bigint, allowance: bigint, blockNumber: bigint];
export type SpResults = readonly [...SnapshotResults, ...SpTail];

/** The dashboard's reads plus the Stability Pool's, one multicall at one block, all on the selected network. */
export function spContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "deposits", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "allowance", args: [account, a.stabilityPool] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
  ] as const;
}

export function parseSpSnapshot(network: NetworkConfig, results: SpResults): SpSnapshot {
  const dashboard = parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults);
  const [initialDeposit, allowance, blockNumber] = results.slice(DASHBOARD_READS) as unknown as SpTail;
  return { dashboard, initialDeposit, allowance, blockNumber };
}
```

Create `web/src/lib/stability-pool/position.ts`:

```ts
import { WAD } from "@/lib/math";
import type { SpCostBasis } from "./cost-basis";
import type { SpSnapshot } from "./snapshot";

export type SpCostView = {
  basis: bigint;
  valueChange: bigint; // value now − basis: "Estimated position value change", never "profit"
  gainsClaimed: bigint; // BTC already paid to the wallet
  absorbed: bigint; // MUSD the deposit gave up to liquidations: realised at past actions + pending now
};
export type SpView = { deposit: bigint; gain: bigint; gainValue: bigint; value: bigint; empty: boolean; cost: SpCostView | null };

/** The Stability Pool card (spec Flow F) from one snapshot and, once loaded, the cost basis. */
export function spView(snapshot: SpSnapshot, basis: SpCostBasis | null): SpView {
  const { deposit, btcGain: gain } = snapshot.dashboard.sp;
  const gainValue = (gain * snapshot.dashboard.price) / WAD;
  const value = deposit + gainValue;
  const pendingLoss = snapshot.initialDeposit > deposit ? snapshot.initialDeposit - deposit : 0n;
  return {
    deposit,
    gain,
    gainValue,
    value,
    empty: snapshot.initialDeposit === 0n,
    cost: basis && {
      basis: basis.basis,
      valueChange: value - basis.basis,
      gainsClaimed: basis.gainsClaimed,
      absorbed: basis.lossRealised + pendingLoss,
    },
  };
}
```

Create `web/src/lib/stability-pool/test-fixtures.ts`:

```ts
import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import type { SpData, SpSnapshot } from "./snapshot";

// Test data only.

/** No deposit yet, 500 MUSD in the wallet, no allowance. */
export function spSnapshotWith(overrides: Partial<SpSnapshot> = {}): SpSnapshot {
  return { dashboard: snapshotWith({ musd: 500n * ONE }), initialDeposit: 0n, allowance: 0n, blockNumber: 16_000_000n, ...overrides };
}

/** Enough BTC for the 3,000,000-gas budget at 146 wei. */
export function spDataWith(overrides: Partial<SpData> = {}): SpData {
  return { snapshot: spSnapshotWith(), gasBalance: ONE / 1_000n, gasPrice: 146n, fetchedAt: 1_000_000, ...overrides };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/lib/stability-pool`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/stability-pool/cost-basis.ts web/src/lib/stability-pool/cost-basis.test.ts web/src/lib/stability-pool/snapshot.ts web/src/lib/stability-pool/snapshot.test.ts web/src/lib/stability-pool/position.ts web/src/lib/stability-pool/position.test.ts web/src/lib/stability-pool/test-fixtures.ts
git commit -m "feat(web): Stability Pool snapshot, cost basis, and position view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gates, steps, calls, intents, gas, and previews

**Files:**
- Create: `web/src/lib/stability-pool/gate.ts`
- Create: `web/src/lib/stability-pool/steps.ts`
- Create: `web/src/lib/stability-pool/calls.ts`
- Create: `web/src/lib/stability-pool/intent.ts`
- Create: `web/src/lib/stability-pool/preview.ts`
- Modify: `web/src/lib/quote/gas.ts`
- Test: `web/src/lib/stability-pool/gate.test.ts`
- Test: `web/src/lib/stability-pool/preview.test.ts`
- Test: `web/src/lib/stability-pool/calls.test.ts`
- Test: `web/src/lib/stability-pool/intent.test.ts`

**Interfaces:**
- Consumes: `writeBlocker`; outcomes `INSUFFICIENT_BALANCE`, `AMOUNT_TOO_SMALL`, `needsGas`, `noExecutor`, `wrongNetwork`, `NO_SP_DEPOSIT`, `NO_SP_GAIN`; `needsApproval`, `encodeApproveCall` (`@/lib/routes/musd-btc-lp/params`); `EXIT_PERCENTS`, `exitLiquidity`, `type ExitPercent` (`@/lib/positions/exit-intent`); `parseMusdAmount`; `lacksGas`; `SpData` (Task 3); `APPROVE_GAS`, `RELAYED_CALL_GAS`.
- Produces:
  - `type SpBlockReason = "no-executor" | "wrong-network" | "zero" | "insufficient-balance" | "no-deposit" | "too-small" | "no-gain" | "needs-gas"`; `type SpBlock = { reason: SpBlockReason; outcome: Outcome | null }`
  - `spDepositBlock(input: { network; walletChainId: number | undefined; musdIn: bigint | null; walletMusd: bigint; lacksGas: boolean }): SpBlock | null`
  - `spWithdrawBlock(input: { network; walletChainId; initialDeposit: bigint; amount: bigint; lacksGas: boolean }): SpBlock | null`
  - `spClaimBlock(input: { network; walletChainId; initialDeposit: bigint; gain: bigint; lacksGas: boolean }): SpBlock | null`
  - `type SpStepKind = "approve" | "deposit"`; `spDepositSteps(allowance: bigint, musdIn: bigint): SpStepKind[]`
  - `encodeProvideCall(amount: bigint): Hex`, `encodeWithdrawCall(amount: bigint): Hex`, `encodeSpApproveCall(network: NetworkConfig, amount: bigint): { to: Address; data: Hex }`
  - `spDepositQuery(amount: string): string`, `parseSpWithdrawPercent(params: { get(name: string): string | null }): ExitPercent`, `spWithdrawQuery(percent: ExitPercent): string`
  - `SP_DEPOSIT_GAS`, `SP_WITHDRAW_GAS`, `spGasUnits(input: { approve: boolean; smartAccount: boolean; action: "deposit" | "withdraw" }): bigint`
  - `type SpDepositPreview = { musdIn: bigint | null; steps: SpStepKind[]; gasCost: bigint | null; depositNow: bigint; gainPaid: bigint; depositAfter: bigint | null; after: DashboardSnapshot | null; block: SpBlock | null }`; `spDepositPreview(input: { network; data: SpData; musdIn: bigint | null; walletKind: WalletKind; walletChainId: number | undefined }): SpDepositPreview`
  - `type SpWithdrawPreview = { amount: bigint; depositAfter: bigint; gainPaid: bigint; gasCost: bigint | null; block: SpBlock | null }`; `spWithdrawPreview(input: { network; data: SpData; percent: ExitPercent; walletKind: WalletKind; walletChainId: number | undefined }): SpWithdrawPreview`
  - `spClaimPreview(input: { network; data: SpData; walletChainId: number | undefined }): SpBlock | null`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/stability-pool/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { spClaimBlock, spDepositBlock, spWithdrawBlock } from "./gate";

const ONE = 10n ** 18n;
const testnet = networks.testnet;
const deposit = (over: Partial<Parameters<typeof spDepositBlock>[0]> = {}) =>
  spDepositBlock({ network: testnet, walletChainId: 31611, musdIn: 10n * ONE, walletMusd: 10n * ONE, lacksGas: false, ...over });

describe("spDepositBlock", () => {
  it("passes a covered amount", () => {
    expect(deposit()).toBeNull();
  });

  it.each([
    [{ network: networks.mainnet, walletChainId: 31612 }, "no-executor"],
    [{ walletChainId: 1 }, "wrong-network"],
    [{ musdIn: null }, "zero"],
    [{ musdIn: 10n * ONE + 1n }, "insufficient-balance"],
    [{ lacksGas: true }, "needs-gas"],
  ] as const)("%j → %s", (over, reason) => {
    expect(deposit(over)?.reason).toBe(reason);
  });

  it("keeps the button silently disabled before an amount is typed", () => {
    expect(deposit({ musdIn: null })?.outcome).toBeNull();
  });

  it("has no mainnet cap: the cap belongs to the executor", () => {
    expect(deposit({ musdIn: 5_000n * ONE, walletMusd: 5_000n * ONE })).toBeNull();
  });
});

describe("spWithdrawBlock", () => {
  const withdraw = (over: Partial<Parameters<typeof spWithdrawBlock>[0]> = {}) =>
    spWithdrawBlock({ network: testnet, walletChainId: 31611, initialDeposit: 10n * ONE, amount: 5n * ONE, lacksGas: false, ...over });

  it.each([
    [{}, null],
    [{ initialDeposit: 0n }, "no-deposit"],
    [{ amount: 0n }, "too-small"],
    [{ lacksGas: true }, "needs-gas"],
    [{ walletChainId: 1 }, "wrong-network"],
  ] as const)("%j → %s", (over, reason) => {
    expect(withdraw(over)?.reason ?? null).toBe(reason);
  });
});

describe("spClaimBlock", () => {
  const claim = (over: Partial<Parameters<typeof spClaimBlock>[0]> = {}) =>
    spClaimBlock({ network: testnet, walletChainId: 31611, initialDeposit: 10n * ONE, gain: 5n, lacksGas: false, ...over });

  it.each([
    [{}, null],
    [{ initialDeposit: 0n, gain: 0n }, "no-deposit"],
    [{ gain: 0n }, "no-gain"],
    [{ lacksGas: true }, "needs-gas"],
  ] as const)("%j → %s", (over, reason) => {
    expect(claim(over)?.reason ?? null).toBe(reason);
  });
});
```

Create `web/src/lib/stability-pool/preview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { APPROVE_GAS, RELAYED_CALL_GAS, SP_DEPOSIT_GAS, SP_WITHDRAW_GAS } from "@/lib/quote/gas";
import { spClaimPreview, spDepositPreview, spWithdrawPreview } from "./preview";
import { spDataWith, spSnapshotWith } from "./test-fixtures";

const withDeposit = spDataWith({
  snapshot: spSnapshotWith({
    dashboard: snapshotWith({ musd: 500n * ONE, sp: { deposit: 40n * ONE, btcGain: 3n } }),
    initialDeposit: 50n * ONE,
  }),
});
const base = { network: networks.testnet, walletChainId: 31611 };

describe("spDepositPreview", () => {
  it("approves, then deposits; the pending gain is paid out and the exposure moves into the pool", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: 10n * ONE, walletKind: "eoa" });
    expect(preview.steps).toEqual(["approve", "deposit"]);
    expect(preview).toMatchObject({ depositNow: 40n * ONE, gainPaid: 3n, depositAfter: 50n * ONE, block: null });
    expect(preview.after?.musd).toBe(490n * ONE);
    expect(preview.after?.sp).toEqual({ deposit: 50n * ONE, btcGain: 0n });
    expect(preview.gasCost).toBe((APPROVE_GAS + SP_DEPOSIT_GAS) * 146n);
  });

  it("skips the approval when the allowance covers the amount", () => {
    const data = spDataWith({ snapshot: spSnapshotWith({ allowance: 10n * ONE }) });
    expect(spDepositPreview({ ...base, data, musdIn: 10n * ONE, walletKind: "eoa" }).steps).toEqual(["deposit"]);
  });

  it("adds the relayer's gas for a Bitcoin wallet", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: 10n * ONE, walletKind: "smart-account" });
    expect(preview.gasCost).toBe((APPROVE_GAS + SP_DEPOSIT_GAS + 2n * RELAYED_CALL_GAS) * 146n);
  });

  it("has no outcome and no after-state without an amount", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: null, walletKind: "eoa" });
    expect(preview).toMatchObject({ after: null, depositAfter: null, block: { reason: "zero" } });
  });
});

describe("spWithdrawPreview", () => {
  it("withdraws the exact compounded deposit at Max", () => {
    const preview = spWithdrawPreview({ ...base, data: withDeposit, percent: 100, walletKind: "eoa" });
    expect(preview).toMatchObject({ amount: 40n * ONE, depositAfter: 0n, gainPaid: 3n, block: null });
    expect(preview.gasCost).toBe(SP_WITHDRAW_GAS * 146n);
  });

  it("rounds a share down", () => {
    const data = spDataWith({
      snapshot: spSnapshotWith({ dashboard: snapshotWith({ sp: { deposit: 3n, btcGain: 0n } }), initialDeposit: 3n }),
    });
    expect(spWithdrawPreview({ ...base, data, percent: 25, walletKind: "eoa" }).amount).toBe(0n);
  });

  it("blocks without a deposit", () => {
    expect(spWithdrawPreview({ ...base, data: spDataWith(), percent: 100, walletKind: "eoa" }).block?.reason).toBe("no-deposit");
  });
});

describe("spClaimPreview", () => {
  it("allows a claim with a pending gain and blocks one without", () => {
    expect(spClaimPreview({ ...base, data: withDeposit })).toBeNull();
    expect(spClaimPreview({ ...base, data: spDataWith() })?.reason).toBe("no-deposit");
  });
});
```

Create `web/src/lib/stability-pool/calls.test.ts`:

```ts
import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { networks } from "@/lib/config/networks";
import { encodeProvideCall, encodeSpApproveCall, encodeWithdrawCall } from "./calls";
import { spDepositSteps } from "./steps";

describe("Stability Pool calls", () => {
  it("round-trips provideToSP and withdrawFromSP (a claim is withdrawFromSP(0))", () => {
    expect(decodeFunctionData({ abi: stabilityPoolAbi, data: encodeProvideCall(7n) })).toEqual({ functionName: "provideToSP", args: [7n] });
    expect(decodeFunctionData({ abi: stabilityPoolAbi, data: encodeWithdrawCall(0n) })).toEqual({ functionName: "withdrawFromSP", args: [0n] });
  });

  it("approves exactly the amount for the pool on the MUSD token", () => {
    const call = encodeSpApproveCall(networks.testnet, 9n);
    expect(call.to).toBe(networks.testnet.addresses.musd);
    expect(decodeFunctionData({ abi: erc20Abi, data: call.data }).args).toEqual([getAddress(networks.testnet.addresses.stabilityPool), 9n]);
  });
});

describe("spDepositSteps", () => {
  it.each([
    [0n, 5n, ["approve", "deposit"]],
    [4n, 5n, ["approve", "deposit"]],
    [5n, 5n, ["deposit"]],
  ] as const)("allowance %s for %s → %j", (allowance, amount, steps) => {
    expect(spDepositSteps(allowance, amount)).toEqual(steps);
  });
});
```

Create `web/src/lib/stability-pool/intent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSpWithdrawPercent, spDepositQuery, spWithdrawQuery } from "./intent";

describe("Stability Pool intents", () => {
  it("carries only the typed amount", () => {
    expect(spDepositQuery("12.5")).toBe("?amount=12.5");
    expect(spDepositQuery("")).toBe("");
  });

  it.each([
    ["25", 25],
    ["100", 100],
    ["33", 100],
    [null, 100],
  ] as const)("percent %j → %s", (param, percent) => {
    expect(parseSpWithdrawPercent(new URLSearchParams(param === null ? "" : `percent=${param}`))).toBe(percent);
  });

  it("round-trips the percent", () => {
    expect(parseSpWithdrawPercent(new URLSearchParams(spWithdrawQuery(50)))).toBe(50);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/lib/stability-pool`
Expected: FAIL (modules not found, `SP_DEPOSIT_GAS` not exported).

- [ ] **Step 3: Implement**

Append to `web/src/lib/quote/gas.ts`:

```ts
/**
 * `provideToSP` and `withdrawFromSP` (F5). Provisional until QA measures them: `cast estimate` of
 * withdrawFromSP with a pending BTC gain gave 225,416 (14 Oct 2026). The budget is only a floor.
 */
export const SP_DEPOSIT_GAS = 330_000n;
export const SP_WITHDRAW_GAS = 330_000n;

/** Estimated gas units for a Stability Pool action, for the preview's network-fee line. */
export function spGasUnits(input: { approve: boolean; smartAccount: boolean; action: "deposit" | "withdraw" }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = (input.action === "deposit" ? SP_DEPOSIT_GAS : SP_WITHDRAW_GAS) + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
```

Create `web/src/lib/stability-pool/gate.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { AMOUNT_TOO_SMALL, INSUFFICIENT_BALANCE, needsGas, NO_SP_DEPOSIT, NO_SP_GAIN, noExecutor, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";

export type SpBlockReason =
  | "no-executor"
  | "wrong-network"
  | "zero"
  | "insufficient-balance"
  | "no-deposit"
  | "too-small"
  | "no-gain"
  | "needs-gas";
/** `outcome` is null when the button simply stays disabled (no amount yet). */
export type SpBlock = { reason: SpBlockReason; outcome: Outcome | null };

type WriteInput = { network: NetworkConfig; walletChainId: number | undefined };

const block = (reason: SpBlockReason, outcome: Outcome | null): SpBlock => ({ reason, outcome });

/** Mainnet stays read-only until M1, like every other write. */
function writeBlock({ network, walletChainId }: WriteInput): SpBlock | null {
  const blocker = writeBlocker(network, walletChainId);
  if (blocker === "no-executor") return block("no-executor", noExecutor(network));
  if (blocker === "wrong-network") return block("wrong-network", wrongNetwork(network));
  return null;
}

/** Flow E; the first matching reason wins. No cap: the per-transaction cap belongs to the executor. */
export function spDepositBlock(input: WriteInput & { musdIn: bigint | null; walletMusd: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.musdIn === null) return block("zero", null);
  if (input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}

/** Flow H. The blocked-withdrawal state comes from simulating the call, not from this gate. */
export function spWithdrawBlock(input: WriteInput & { initialDeposit: bigint; amount: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.initialDeposit === 0n) return block("no-deposit", NO_SP_DEPOSIT);
  if (input.amount === 0n) return block("too-small", AMOUNT_TOO_SMALL);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}

/** Claim BTC gain is `withdrawFromSP(0)`: it needs a deposit and a gain, and is never paused. */
export function spClaimBlock(input: WriteInput & { initialDeposit: bigint; gain: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.initialDeposit === 0n) return block("no-deposit", NO_SP_DEPOSIT);
  if (input.gain === 0n) return block("no-gain", NO_SP_GAIN);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}
```

Create `web/src/lib/stability-pool/steps.ts`:

```ts
import { needsApproval } from "@/lib/routes/musd-btc-lp/params";

export type SpStepKind = "approve" | "deposit";

/** The pool has no permit, so every wallet kind approves the exact amount unless the allowance covers it. */
export function spDepositSteps(allowance: bigint, musdIn: bigint): SpStepKind[] {
  return needsApproval(allowance, musdIn) ? ["approve", "deposit"] : ["deposit"];
}
```

Create `web/src/lib/stability-pool/calls.ts`:

```ts
import { encodeFunctionData, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { encodeApproveCall } from "@/lib/routes/musd-btc-lp/params";

export function encodeProvideCall(amount: bigint): Hex {
  return encodeFunctionData({ abi: stabilityPoolAbi, functionName: "provideToSP", args: [amount] });
}

/** `withdrawFromSP(0)` is the BTC-gain claim: it pays the gain, keeps the deposit, and is never paused. */
export function encodeWithdrawCall(amount: bigint): Hex {
  return encodeFunctionData({ abi: stabilityPoolAbi, functionName: "withdrawFromSP", args: [amount] });
}

export function encodeSpApproveCall(network: NetworkConfig, amount: bigint): { to: Address; data: Hex } {
  return { to: network.addresses.musd, data: encodeApproveCall(network.addresses.stabilityPool, amount) };
}
```

Create `web/src/lib/stability-pool/intent.ts`:

```ts
import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";

/** The deposit pages pass only the typed amount in the URL. */
export function spDepositQuery(amount: string): string {
  return amount ? `?${new URLSearchParams({ amount }).toString()}` : "";
}

/** Withdraw presets are the LP exit's: 25 / 50 / 75 / Max (100, the default). */
export function parseSpWithdrawPercent(params: { get(name: string): string | null }): ExitPercent {
  const percent = Number(params.get("percent"));
  return EXIT_PERCENTS.find((value) => value === percent) ?? 100;
}

export function spWithdrawQuery(percent: ExitPercent): string {
  return `?percent=${percent}`;
}
```

Create `web/src/lib/stability-pool/preview.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exitLiquidity, type ExitPercent } from "@/lib/positions/exit-intent";
import { spGasUnits } from "@/lib/quote/gas";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { spClaimBlock, spDepositBlock, spWithdrawBlock, type SpBlock } from "./gate";
import type { SpData } from "./snapshot";
import { spDepositSteps, type SpStepKind } from "./steps";

type Common = { network: NetworkConfig; data: SpData; walletChainId: number | undefined };

export type SpDepositPreview = {
  musdIn: bigint | null;
  steps: SpStepKind[];
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  depositNow: bigint; // compounded
  gainPaid: bigint; // the pending BTC gain provideToSP pays to the wallet
  depositAfter: bigint | null;
  after: DashboardSnapshot | null; // for the exposure before/after
  block: SpBlock | null;
};

/** Everything both deposit pages show and gate on, from one snapshot (Flow E). */
export function spDepositPreview(input: Common & { musdIn: bigint | null; walletKind: WalletKind }): SpDepositPreview {
  const { snapshot } = input.data;
  const { dashboard } = snapshot;
  const steps = spDepositSteps(snapshot.allowance, input.musdIn ?? 0n);
  const units = spGasUnits({ approve: steps.includes("approve"), smartAccount: input.walletKind === "smart-account", action: "deposit" });
  const depositAfter = input.musdIn === null ? null : dashboard.sp.deposit + input.musdIn;
  return {
    musdIn: input.musdIn,
    steps,
    gasCost: input.data.gasPrice === undefined ? null : units * input.data.gasPrice,
    depositNow: dashboard.sp.deposit,
    gainPaid: dashboard.sp.btcGain,
    depositAfter,
    after:
      input.musdIn === null || depositAfter === null
        ? null
        : { ...dashboard, musd: dashboard.musd - input.musdIn, sp: { deposit: depositAfter, btcGain: 0n } },
    block: spDepositBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      musdIn: input.musdIn,
      walletMusd: dashboard.musd,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
    }),
  };
}

export type SpWithdrawPreview = { amount: bigint; depositAfter: bigint; gainPaid: bigint; gasCost: bigint | null; block: SpBlock | null };

/** Flow H: a share of the compounded deposit; Max is the exact deposit, so no dust stays behind. */
export function spWithdrawPreview(input: Common & { percent: ExitPercent; walletKind: WalletKind }): SpWithdrawPreview {
  const { snapshot } = input.data;
  const compounded = snapshot.dashboard.sp.deposit;
  const amount = exitLiquidity(compounded, input.percent);
  const units = spGasUnits({ approve: false, smartAccount: input.walletKind === "smart-account", action: "withdraw" });
  return {
    amount,
    depositAfter: compounded - amount,
    gainPaid: snapshot.dashboard.sp.btcGain,
    gasCost: input.data.gasPrice === undefined ? null : units * input.data.gasPrice,
    block: spWithdrawBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      initialDeposit: snapshot.initialDeposit,
      amount,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
    }),
  };
}

export function spClaimPreview(input: Common): SpBlock | null {
  const { snapshot } = input.data;
  return spClaimBlock({
    network: input.network,
    walletChainId: input.walletChainId,
    initialDeposit: snapshot.initialDeposit,
    gain: snapshot.dashboard.sp.btcGain,
    lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/lib/stability-pool src/lib/quote`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/quote/gas.ts web/src/lib/stability-pool/gate.ts web/src/lib/stability-pool/gate.test.ts web/src/lib/stability-pool/steps.ts web/src/lib/stability-pool/calls.ts web/src/lib/stability-pool/calls.test.ts web/src/lib/stability-pool/intent.ts web/src/lib/stability-pool/intent.test.ts web/src/lib/stability-pool/preview.ts web/src/lib/stability-pool/preview.test.ts
git commit -m "feat(web): Stability Pool gates, calls, and deposit/withdraw previews

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Receipt decoding

**Files:**
- Create: `web/src/lib/stability-pool/receipt.ts`
- Modify: `web/src/lib/tx/receipt-kind.ts`
- Modify: `web/src/components/receipt/ReceiptPage.tsx`
- Test: `web/src/lib/stability-pool/receipt.test.ts`
- Test: `web/src/lib/tx/receipt-kind.test.ts` (extend)

**Interfaces:**
- Consumes: `stabilityPoolAbi` (Task 1); `LogLike` (`@/lib/routes/musd-btc-lp/receipt`); `formatToken`.
- Produces:
  - `type SpReceipt = { kind: "sp-deposit" | "sp-withdraw" | "sp-claim"; depositor: Address; amount: bigint; gain: bigint; loss: bigint; depositAfter: bigint }`
  - `findSpReceipt(logs: readonly LogLike[], network: NetworkConfig): SpReceipt | null`
  - `spReceiptRows(receipt: SpReceipt): { label: string; value: string }[]`
  - `ReceiptKind` gains `| { kind: SpReceipt["kind"]; sp: SpReceipt }`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/stability-pool/receipt.test.ts`:

```ts
import { encodeAbiParameters, getAddress, pad, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";
import { findSpReceipt, spReceiptRows } from "./receipt";

const ONE = 10n ** 18n;
const SP = networks.testnet.addresses.stabilityPool;
const MUSD = networks.testnet.addresses.musd;
const DEPOSITOR = "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826";

// tx 0x9062b702bb46635dbf78b5aa55405e180fbb57093cc501ffa86d08fbe36c3cc6 (testnet block 15,439,988):
// a contract depositor's provideToSP(15 MUSD); its own logs come first.
const LIVE_DEPOSIT: LogLike[] = [
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
  { address: "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7"], data: "0x00000000000000000000000000000000000000000000032d26d12e980b600000" },
  { address: "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826", topics: ["0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc000000000000000000000000000000000000000000000000032d26d12e980b600000" },
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826", "0x0000000000000000000000001cca7e410ee41739792ea0a24e00349dd247680e"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xc48943df4095f4f20d171fd2872eafdc0eed4d9014ac3672f3bde7fd425449d5", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x0000000000000000000000000000000000000000000000000bf78bd6c4f3ed8600000000000000000000000000000000000000163e1cbf80b61c43ffbc0cbc26" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x000000000000000000000000000000000000000000000002ed6689e54f180000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0x47647c495a7db9471a1b024b3c6f7555a502a0de4b130d83a4d3c8f9cff25939", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xfb502a10a442e29149185372d74b953304b5bc0a0d9d431c070905d3dfbc89e3"], data: "0x0000000000000000000000000000000000000000004754566080a0ea403fdd9f" },
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826", "0x0000000000000000000000001cca7e410ee41739792ea0a24e00349dd247680e"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
];

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const word = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]);
const topic = (address: Address) => pad(address.toLowerCase() as Address, { size: 32 });
const depositChanged = (newDeposit: bigint): LogLike => ({
  address: SP,
  topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", topic(DEPOSITOR)],
  data: word(newDeposit),
});
const gainWithdrawn = (gain: bigint, loss: bigint): LogLike => ({
  address: SP,
  topics: ["0x47647c495a7db9471a1b024b3c6f7555a502a0de4b130d83a4d3c8f9cff25939", topic(DEPOSITOR)],
  data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [gain, loss]),
});
const transfer = (from: Address, to: Address, value: bigint): LogLike => ({ address: MUSD, topics: [TRANSFER, topic(from), topic(to)] as Hex[], data: word(value) });

describe("findSpReceipt", () => {
  it("decodes the live provideToSP: 15 MUSD in, deposit now 54 MUSD", () => {
    expect(findSpReceipt(LIVE_DEPOSIT, networks.testnet)).toEqual({
      kind: "sp-deposit",
      depositor: getAddress(DEPOSITOR), // viem returns checksummed addresses
      amount: 15n * ONE,
      gain: 0n,
      loss: 0n,
      depositAfter: 54n * ONE,
    });
  });

  it("reads MUSD sent from the pool to the depositor as a withdrawal", () => {
    const logs = [transfer(SP, DEPOSITOR, 40n * ONE), depositChanged(0n), gainWithdrawn(3n, 5n * ONE)];
    expect(findSpReceipt(logs, networks.testnet)).toMatchObject({ kind: "sp-withdraw", amount: 40n * ONE, gain: 3n, loss: 5n * ONE, depositAfter: 0n });
  });

  it("reads a call that moves no MUSD as a BTC-gain claim", () => {
    expect(findSpReceipt([depositChanged(40n * ONE), gainWithdrawn(3n, 0n)], networks.testnet)).toMatchObject({ kind: "sp-claim", amount: 0n, gain: 3n });
  });

  it("ignores another contract's look-alike events and returns null without pool events", () => {
    const fake = { ...depositChanged(1n), address: MUSD };
    expect(findSpReceipt([fake], networks.testnet)).toBeNull();
  });

  it("lists the rows of a deposit", () => {
    const rows = spReceiptRows({ kind: "sp-deposit", depositor: DEPOSITOR, amount: 15n * ONE, gain: 0n, loss: 0n, depositAfter: 54n * ONE });
    expect(rows.map((row) => row.label)).toEqual(["MUSD deposited", "BTC gain paid", "Deposit loss realised", "Deposit now"]);
  });
});
```

Extend `web/src/lib/tx/receipt-kind.test.ts` (read it first; reuse its imports and network) with:

```ts
import { encodeAbiParameters } from "viem";

it("decodes a Stability Pool action when there is no executor or pool event", () => {
  const depositor = "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826";
  const logs = [
    {
      address: networks.testnet.addresses.stabilityPool,
      topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", depositor] as const,
      data: encodeAbiParameters([{ type: "uint256" }], [5n]),
    },
  ];
  expect(receiptKind(logs, networks.testnet)).toMatchObject({ kind: "sp-claim", sp: { depositAfter: 5n } });
});
```

(If the test file declares its logs with a specific type, cast the new `logs` to it; the topics must be `readonly Hex[]`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/lib/stability-pool/receipt.test.ts src/lib/tx/receipt-kind.test.ts`
Expected: FAIL (module `./receipt` not found; `receiptKind` returns null).

- [ ] **Step 3: Implement**

Create `web/src/lib/stability-pool/receipt.ts`:

```ts
import { decodeEventLog, erc20Abi, isAddressEqual, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";

/** What one Stability Pool call did, from its events only (FR-11). */
export type SpReceipt = {
  kind: "sp-deposit" | "sp-withdraw" | "sp-claim";
  depositor: Address;
  amount: bigint; // MUSD moved: in for a deposit, out for a withdrawal, 0 for a claim
  gain: bigint; // BTC paid to the depositor
  loss: bigint; // MUSD the deposit had absorbed since the previous action
  depositAfter: bigint;
};

// decodeEventLog throws on an unknown or missing topic; callers check `eventName` (it decodes any ABI event).
function decodePool(log: LogLike) {
  try {
    return decodeEventLog({ abi: stabilityPoolAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
  } catch {
    return null;
  }
}

function decodeToken(log: LogLike) {
  try {
    return decodeEventLog({ abi: erc20Abi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
  } catch {
    return null;
  }
}

/**
 * `UserDepositChanged` names the depositor (its indexed topic) and the deposit after the call;
 * `CollateralGainWithdrawn` the BTC gain and the loss. The MUSD `Transfer` between the depositor and
 * the pool tells a deposit from a withdrawal; a zero withdrawal sends no MUSD, so none means a claim.
 */
export function findSpReceipt(logs: readonly LogLike[], network: NetworkConfig): SpReceipt | null {
  const pool = network.addresses.stabilityPool;
  let depositor: Address | null = null;
  let depositAfter = 0n;
  let gain = 0n;
  let loss = 0n;
  for (const log of logs) {
    if (!isAddressEqual(log.address, pool)) continue;
    const decoded = decodePool(log);
    if (decoded?.eventName === "UserDepositChanged" && depositor === null) {
      depositor = decoded.args.depositor;
      depositAfter = decoded.args.newDeposit;
    }
    if (decoded?.eventName === "CollateralGainWithdrawn") {
      gain = decoded.args.collateral;
      loss = decoded.args.MUSDLoss;
    }
  }
  if (depositor === null) return null;
  for (const log of logs) {
    if (!isAddressEqual(log.address, network.addresses.musd)) continue;
    const decoded = decodeToken(log);
    if (decoded?.eventName !== "Transfer") continue;
    const { from, to, value } = decoded.args;
    if (isAddressEqual(from, depositor) && isAddressEqual(to, pool)) return { kind: "sp-deposit", depositor, amount: value, gain, loss, depositAfter };
    if (isAddressEqual(from, pool) && isAddressEqual(to, depositor)) return { kind: "sp-withdraw", depositor, amount: value, gain, loss, depositAfter };
  }
  return { kind: "sp-claim", depositor, amount: 0n, gain, loss, depositAfter };
}

const musd = (value: bigint) => `${formatToken(value)} MUSD`;
const btc = (value: bigint) => `${formatToken(value)} BTC`;

export function spReceiptRows(receipt: SpReceipt): { label: string; value: string }[] {
  const moved =
    receipt.kind === "sp-deposit"
      ? [{ label: "MUSD deposited", value: musd(receipt.amount) }]
      : receipt.kind === "sp-withdraw"
        ? [{ label: "MUSD withdrawn", value: musd(receipt.amount) }]
        : [];
  return [
    ...moved,
    { label: receipt.kind === "sp-claim" ? "BTC gain claimed" : "BTC gain paid", value: btc(receipt.gain) },
    { label: "Deposit loss realised", value: musd(receipt.loss) },
    { label: "Deposit now", value: musd(receipt.depositAfter) },
  ];
}
```

`web/src/lib/tx/receipt-kind.ts`: import `findSpReceipt, type SpReceipt` from `@/lib/stability-pool/receipt`; add `| { kind: SpReceipt["kind"]; sp: SpReceipt }` to `ReceiptKind`; change the doc comment to "…an entry, an exit, a fee claim, or a Stability Pool action."; replace the last two lines of `receiptKind` with:

```ts
  const fees = findClaimEvent(logs, network);
  if (fees) return { kind: "claim", fees };
  const sp = findSpReceipt(logs, network);
  return sp ? { kind: sp.kind, sp } : null;
```

`web/src/components/receipt/ReceiptPage.tsx`:
- import `spReceiptRows` from `@/lib/stability-pool/receipt`;
- replace `TITLES` with:

```ts
const TITLES = {
  entered: "Deposit confirmed",
  exited: "Exit confirmed",
  claim: "Fees claimed",
  "sp-deposit": "Stability Pool deposit confirmed",
  "sp-withdraw": "Stability Pool withdrawal confirmed",
  "sp-claim": "BTC gain claimed",
} as const;
```

- replace the `rows` expression in `Confirmed` with:

```ts
  const rows =
    result.kind === "entered"
      ? enteredRows(result.event)
      : result.kind === "exited"
        ? exitedRows(result.event)
        : result.kind === "claim"
          ? claimRows(result.fees)
          : spReceiptRows(result.sp);
```

- change the component doc comment to mention the Stability Pool events, and the "no MezoRoute action" copy stays.

- [ ] **Step 4: Run tests and type check**

Run: `cd web && npx vitest run src/lib/stability-pool src/lib/tx && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/stability-pool/receipt.ts web/src/lib/stability-pool/receipt.test.ts web/src/lib/tx/receipt-kind.ts web/src/lib/tx/receipt-kind.test.ts web/src/components/receipt/ReceiptPage.tsx
git commit -m "feat(web): decode Stability Pool deposits, withdrawals, and claims on the receipt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Deposit route and confirm pages

**Files:**
- Create: `web/src/lib/stability-pool/useSpSnapshot.ts`
- Create: `web/src/lib/stability-pool/useSpDepositFlow.ts`
- Create: `web/src/components/lp/AmountInput.tsx`
- Modify: `web/src/components/lp/AmountForm.tsx`
- Modify: `web/src/components/lp/ExposureChange.tsx`
- Create: `web/src/components/stability-pool/SpDepositCard.tsx`
- Create: `web/src/components/stability-pool/SpRisksCard.tsx`
- Create: `web/src/components/stability-pool/SpDepositStepper.tsx`
- Create: `web/src/components/stability-pool/SpRoutePage.tsx`
- Create: `web/src/components/stability-pool/SpConfirmPage.tsx`
- Create: `web/src/app/route/stability-pool/page.tsx`
- Create: `web/src/app/route/stability-pool/confirm/page.tsx`
- Modify: `web/src/components/dashboard/ReadinessCard.tsx`

**Interfaces:**
- Consumes: `spContracts`, `parseSpSnapshot`, `SpData`, `SpResults` (Task 3); `spDepositPreview`, `SpDepositPreview` (Task 4); `spDepositQuery`; `encodeProvideCall`, `encodeSpApproveCall`; `SpStepKind`; `SP_DEPOSIT_GAS`, `APPROVE_GAS`; `QUOTE_REFRESH_MS`; `submitCall`, `confirmCall`, `SendPin`; `createStepper`, `stepperReducer`, `hasStarted`, `Stepper`; `StepAction`, `BlockNotice`, `ExposurePanel`, `RequireWallet`, `WrongNetworkAlert`, `LoadError`, `StatRow`; `musd`, `btc` (`@/components/lp/units`); `parseMusdAmount`; `useWalletKind`.
- Produces:
  - `useSpSnapshot(account: Address): { data: SpData | undefined; error: Error | null; refresh: () => Promise<SpData> }`
  - `useSpDepositFlow(input: { account: Address; musdIn: bigint; walletKind: WalletKind; plan: SpStepKind[]; refresh: () => Promise<SpData> }): { stepper: Stepper<SpStepKind>; run: () => void }`
  - `AmountInput({ amount, max, maxLabel, onAmount })`
  - Pages `/route/stability-pool/` and `/route/stability-pool/confirm/`

No unit tests: these are hooks and components over the tested pure modules (the repo does not unit-test hooks); the build type-checks them and Task 9 exercises them live.

- [ ] **Step 1: Snapshot hook**

Create `web/src/lib/stability-pool/useSpSnapshot.ts` (mirrors `usePositionsSnapshot`):

```ts
"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { parseSpSnapshot, spContracts, type SpData, type SpResults } from "./snapshot";

/**
 * The Stability Pool reads on the selected network: one multicall snapshot plus gas balance and
 * price, refetched every 15 s. `refresh` resolves with fresh data (every send re-gates on it).
 */
export function useSpSnapshot(account: Address): { data: SpData | undefined; error: Error | null; refresh: () => Promise<SpData> } {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: spContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: QUOTE_REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (results: unknown, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): SpData => ({
    snapshot: parseSpSnapshot(network, results as SpResults),
    gasBalance,
    gasPrice: price,
    fetchedAt,
  });

  return {
    data: reads.data && gas.data ? toData(reads.data, gas.data.value, gasPrice.data, reads.dataUpdatedAt) : undefined,
    error: reads.error ?? gas.error ?? null,
    refresh: async () => {
      const [freshReads, freshGas, freshPrice] = await Promise.all([reads.refetch(), gas.refetch(), gasPrice.refetch()]);
      if (freshReads.error) throw freshReads.error;
      if (freshGas.error) throw freshGas.error;
      if (!freshReads.data || !freshGas.data) throw new Error("Stability Pool snapshot unavailable");
      return toData(freshReads.data, freshGas.data.value, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
```

- [ ] **Step 2: Deposit flow hook**

Create `web/src/lib/stability-pool/useSpDepositFlow.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { ALLOWANCE, AMOUNT_TOO_SMALL } from "@/lib/errors/outcomes";
import { APPROVE_GAS, SP_DEPOSIT_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { encodeProvideCall, encodeSpApproveCall } from "./calls";
import { spDepositPreview } from "./preview";
import type { SpData } from "./snapshot";
import type { SpStepKind } from "./steps";

export type SpDepositFlowInput = {
  account: Address;
  musdIn: bigint;
  walletKind: WalletKind;
  plan: SpStepKind[];
  refresh: () => Promise<SpData>;
};

/**
 * Flow E (spec §9 screen 3b): an exact MUSD approval to the pool when the allowance is short, then
 * `provideToSP`. Account and chain are pinned on the first step; the deposit re-gates on a fresh
 * snapshot, checks the allowance, simulates, submits, and hands the hash to the receipt page.
 */
export function useSpDepositFlow(input: SpDepositFlowInput): { stepper: Stepper<SpStepKind>; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<SpStepKind>, input.plan, createStepper<SpStepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as SpStepKind[] });
  }, [planKey]);

  async function approve(sendPin: SendPin) {
    const hash = await submitCall(config, encodeSpApproveCall(network, input.musdIn), sendPin, APPROVE_GAS);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function deposit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const preview = spDepositPreview({
      network,
      data: fresh,
      musdIn: input.musdIn,
      walletKind: input.walletKind,
      walletChainId: getAccount(config).chainId,
    });
    if (preview.block) throw new BlockedError(preview.block.outcome ?? AMOUNT_TOO_SMALL);
    // The approval may not be visible yet on a lagging node; never send a transfer that would revert.
    if (fresh.snapshot.allowance < input.musdIn) throw new BlockedError(ALLOWANCE);
    // A simulated revert is decoded and nothing is sent.
    await simulateContract(config, {
      address: network.addresses.stabilityPool,
      abi: stabilityPoolAbi,
      functionName: "provideToSP",
      args: [input.musdIn],
      account: sendPin.account,
      chainId: sendPin.chainId,
    });
    const call = { to: network.addresses.stabilityPool, data: encodeProvideCall(input.musdIn) };
    const hash = await submitCall(config, call, sendPin, SP_DEPOSIT_GAS);
    dispatch({ type: "submitted", hash });
    router.push(`/tx/?hash=${hash}`);
  }

  async function runActive() {
    const step = stepperRef.current.steps[stepperRef.current.active];
    if (!step) return;
    pin.current ??= { account: input.account, chainId: network.chainId };
    const sendPin = pin.current;
    dispatch({ type: "start" });
    try {
      if (step.kind === "approve") await approve(sendPin);
      else await deposit(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, { retry: () => void runActive() });
    }
  }

  return { stepper, run: () => void runActive() };
}
```

- [ ] **Step 3: Extract `AmountInput` and show the SP gain in `ExposureChange`**

Create `web/src/components/lp/AmountInput.tsx` from the input part of `AmountForm`:

```tsx
import { formatUnits } from "viem";
import { formatToken } from "@/lib/format";

/** A MUSD amount with Max; shared by the LP and Stability Pool routes. */
export function AmountInput({
  amount,
  max,
  maxLabel,
  onAmount,
}: {
  amount: string;
  max: bigint;
  maxLabel: string;
  onAmount: (amount: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label htmlFor="amount" className="block text-sm font-medium">
        Amount
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 focus-within:border-accent">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none"
        />
        <span className="text-sm text-muted">MUSD</span>
        <button
          type="button"
          onClick={() => onAmount(formatUnits(max, 18))}
          className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
        >
          Max
        </button>
      </div>
      <p className="text-xs text-muted">
        {maxLabel}: {formatToken(max, 18, 2)} MUSD
      </p>
    </div>
  );
}
```

In `web/src/components/lp/AmountForm.tsx`, replace the `<label>…</p>` block (the label, the input row, and the max line) with

```tsx
      <AmountInput amount={amount} max={max} maxLabel={maxLabel} onAmount={(next) => onChange({ amount: next, slippageBps })} />
```

add `import { AmountInput } from "./AmountInput";`, and remove the now-unused `formatUnits` import (keep `formatBps`, drop `formatToken` if unused). The rendered LP page must look the same.

In `web/src/components/lp/ExposureChange.tsx`, between the LP row and the total row, add the Stability Pool row, shown when either side has a deposit or gain, and update the comment to "(Flows C and E, FR-15)":

```tsx
        {(now.spDeposit > 0n || next.spDeposit > 0n || now.spBtcGain > 0n) && (
          <StatRow label="Stability Pool BTC gain">
            {btc(now.spBtcGain)} → {btc(next.spBtcGain)}
          </StatRow>
        )}
```

- [ ] **Step 4: SP components**

Create `web/src/components/stability-pool/SpDepositCard.tsx`:

```tsx
import { StatRow } from "@/components/dashboard/StatRow";
import { btc, musd } from "@/components/lp/units";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

/** What the deposit does (Flow E step 1): estimated until the receipt. */
export function SpDepositCard({ preview }: { preview: SpDepositPreview }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">What happens</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Your deposit now">{musd(preview.depositNow)}</StatRow>
        <StatRow label="Pending BTC gain" sub="Paid to your wallet with this deposit">
          {btc(preview.gainPaid)}
        </StatRow>
        {preview.depositAfter !== null && (
          <StatRow label="Deposit after (estimated)" strong>
            {musd(preview.depositAfter)}
          </StatRow>
        )}
        <StatRow label="MezoRoute fee">None (direct protocol call)</StatRow>
        <StatRow label="Network fee (estimated)">{preview.gasCost === null ? "—" : btc(preview.gasCost)}</StatRow>
      </dl>
    </section>
  );
}
```

Create `web/src/components/stability-pool/SpRisksCard.tsx`:

```tsx
const RISKS = [
  "Your deposit shrinks when the pool absorbs liquidated debt; you receive that Trove's BTC instead, usually worth more than the debt.",
  "Withdrawals pause while any Trove is under-collateralised. Claiming your BTC gain is never paused.",
  "BTC gains arrive only when liquidations happen, and their value moves with the BTC price.",
];

export function SpRisksCard() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Risks</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {RISKS.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
```

Create `web/src/components/stability-pool/SpDepositStepper.tsx`:

```tsx
"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { StepAction } from "@/components/lp/EntryStepper";
import type { SpBlock } from "@/lib/stability-pool/gate";
import type { SpStepKind } from "@/lib/stability-pool/steps";
import { useSpDepositFlow, type SpDepositFlowInput } from "@/lib/stability-pool/useSpDepositFlow";

const COPY: Record<SpStepKind, { title: string; detail: string; action: string }> = {
  approve: {
    title: "Approve MUSD",
    detail: "Lets the Stability Pool take exactly this amount, in a separate transaction.",
    action: "Approve",
  },
  deposit: {
    title: "Deposit into the Stability Pool",
    detail: "One transaction: the pool takes your MUSD and pays any pending BTC gain to your wallet. No MezoRoute fee.",
    action: "Send",
  },
};

export function SpDepositStepper({ block, ...flow }: SpDepositFlowInput & { block: SpBlock | null }) {
  const { stepper, run } = useSpDepositFlow(flow);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Confirm</h2>
      <ol className="mt-3 space-y-3">
        {stepper.steps.map((step, index) => (
          <li key={step.kind} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
            <div>
              <p className="text-sm font-semibold">
                {index + 1}. {COPY[step.kind].title}
              </p>
              <p className="text-xs text-muted">{COPY[step.kind].detail}</p>
              {step.status === "failed" && step.error && <p className="mt-1 text-xs text-danger">{step.error.message}</p>}
            </div>
            <StepAction step={step} active={index === stepper.active} disabled={block !== null} label={COPY[step.kind].action} onRun={run} />
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">MezoRoute never holds your MUSD: you call the Stability Pool directly.</p>
      <div className="mt-2">
        <BlockNotice block={block} />
      </div>
    </section>
  );
}
```

Create `web/src/components/stability-pool/SpRoutePage.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { AmountInput } from "@/components/lp/AmountInput";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { ExposureChange } from "@/components/lp/ExposureChange";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpDepositCard } from "./SpDepositCard";
import { SpRisksCard } from "./SpRisksCard";

/** Spec §9 screen 2b: amount, current deposit and pending BTC gain, exposure before/after, risks, Review. */
export default function SpRoutePage() {
  return <RequireWallet>{(account) => <SpRoute account={account} />}</RequireWallet>;
}

function SpRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(() => searchParams.get("amount") ?? "");
  const { data, error, refresh } = useSpSnapshot(account);

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the Stability Pool" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const musdIn = parseMusdAmount(amount);
  const preview = spDepositPreview({ network, data, musdIn, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const dashboard = data.snapshot.dashboard;
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Back the system in the Stability Pool</h1>
        <p className="mt-1 text-sm text-muted">
          Your MUSD repays liquidated debt; in return you receive the liquidated BTC collateral.
        </p>
        <div className="mt-4">
          <AmountInput
            amount={amount}
            max={dashboard.musd}
            maxLabel="In your wallet"
            onAmount={(next) => {
              setAmount(next);
              window.history.replaceState(null, "", spDepositQuery(next) || window.location.pathname);
            }}
          />
        </div>
      </section>
      <SpDepositCard preview={preview} />
      {preview.after && <ExposureChange before={dashboard} after={preview.after} />}
      {preview.after && <ExposurePanel snapshot={preview.after} title="BTC exposure after this deposit" />}
      <SpRisksCard />
      <div className="flex items-center justify-between gap-3">
        <BlockNotice block={preview.block} />
        {preview.block ? (
          <span aria-disabled="true" className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white opacity-50">
            Review
          </span>
        ) : (
          <Link
            href={`/route/stability-pool/confirm/${spDepositQuery(amount)}`}
            className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Review
          </Link>
        )}
      </div>
    </>
  );
}
```

Create `web/src/components/stability-pool/SpConfirmPage.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpDepositCard } from "./SpDepositCard";
import { SpDepositStepper } from "./SpDepositStepper";

/** Spec §9 screen 3b: exact approval (skipped if the allowance suffices) → provideToSP. */
export default function SpConfirmPage() {
  return <RequireWallet>{(account) => <SpConfirm account={account} />}</RequireWallet>;
}

function SpConfirm({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const router = useRouter();
  const amount = useSearchParams().get("amount") ?? "";
  const musdIn = parseMusdAmount(amount);
  const { data, error, refresh } = useSpSnapshot(account);

  useEffect(() => {
    if (musdIn === null) router.replace(`/route/stability-pool/${spDepositQuery(amount)}`);
  }, [musdIn, amount, router]);

  if (musdIn === null) return null;
  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the Stability Pool" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const preview = spDepositPreview({ network, data, musdIn, walletKind, walletChainId: chainId });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <SpDepositCard preview={preview} />
      <SpDepositStepper account={account} musdIn={musdIn} walletKind={walletKind} plan={preview.steps} refresh={refresh} block={preview.block} />
      <Link href={`/route/stability-pool/${spDepositQuery(amount)}`} className="inline-block text-xs font-semibold text-accent hover:underline">
        Change amount
      </Link>
    </>
  );
}
```

Create `web/src/app/route/stability-pool/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const SpRoutePage = dynamic(() => import("@/components/stability-pool/SpRoutePage"), { ssr: false });

export default function Page() {
  return <SpRoutePage />;
}
```

Create `web/src/app/route/stability-pool/confirm/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

const SpConfirmPage = dynamic(() => import("@/components/stability-pool/SpConfirmPage"), { ssr: false });

export default function Page() {
  return <SpConfirmPage />;
}
```

- [ ] **Step 5: Dashboard entry point**

In `web/src/components/dashboard/ReadinessCard.tsx`, replace the `readiness.state === "ready"` block with one that offers both destinations:

```tsx
      {readiness.state === "ready" && network.executor && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/route/lp/"
            className="inline-block rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
          >
            Deposit into LP
          </Link>
          <Link
            href="/route/stability-pool/"
            className="inline-block rounded-full border border-accent px-4 py-2 text-xs font-semibold text-accent hover:bg-accent-soft"
          >
            Back the system
          </Link>
        </div>
      )}
```

- [ ] **Step 6: Test, build**

Run: `cd web && npm test && npm run build`
Expected: all tests pass; build succeeds (lint + types); the export contains `out/route/stability-pool/index.html` and `out/route/stability-pool/confirm/index.html`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/stability-pool/useSpSnapshot.ts web/src/lib/stability-pool/useSpDepositFlow.ts web/src/components/lp/AmountInput.tsx web/src/components/lp/AmountForm.tsx web/src/components/lp/ExposureChange.tsx web/src/components/stability-pool web/src/app/route/stability-pool web/src/components/dashboard/ReadinessCard.tsx
git commit -m "feat(web): Stability Pool deposit route and confirm pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stability Pool position card, history, and claim

**Files:**
- Create: `web/src/lib/stability-pool/useSpHistory.ts`
- Create: `web/src/lib/stability-pool/useSpActions.ts`
- Create: `web/src/components/stability-pool/SpPositionCard.tsx`
- Modify: `web/src/components/positions/PositionsPage.tsx`
- Modify: `web/src/components/dashboard/PositionsSummary.tsx`
- Modify: `web/src/components/dashboard/Dashboard.tsx`

**Interfaces:**
- Consumes: `fetchSpHistoryRows`, `browserFetchJson`, `spActions` (Task 2); `spCostBasis`, `historyLagging`, `HistoryLagError`, `historyStatus`, `HistoryStatus`, `SpCostBasis`, `spView`, `SpView` (Task 3); `spClaimPreview`, `spWithdrawPreview`, `SpBlock`, `spWithdrawQuery`, `encodeWithdrawCall`, `SP_WITHDRAW_GAS` (Task 4); `useSpSnapshot` (Task 6); `exposure` (`@/lib/exposure/exposure`).
- Produces:
  - `useSpHistory(account: Address, initialDeposit: bigint | undefined): { status: HistoryStatus; basis: SpCostBasis | null; retry: () => void }`
  - `useSpActions(account: Address, refresh: () => Promise<SpData>): { withdraw: (percent: ExitPercent) => void; claim: () => void; pending: "withdraw" | "claim" | null }`
  - `SpPositionCard({ view, history, claimBlock, onClaim, claiming })`
  - `PositionsSummary({ account, spValue })`

- [ ] **Step 1: History hook**

Create `web/src/lib/stability-pool/useSpHistory.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useNetwork } from "@/lib/config/network-context";
import { HistoryLagError, historyLagging, historyStatus, spCostBasis, type HistoryStatus, type SpCostBasis } from "./cost-basis";
import { browserFetchJson } from "./explorer";
import { fetchSpHistoryRows, spActions } from "./history";

const HISTORY_REFRESH_MS = 60_000;
/** A lagging explorer is asked again every 15 s, four times, before the rows say "Unavailable". */
const LAG_RETRIES = 4;
const LAG_RETRY_MS = 15_000;

/**
 * The cost basis from the explorer API (spec F5 §2). The query key carries `deposits(account)`, so a
 * confirmed action refetches; a history that does not end at that deposit is a lag, not an answer.
 */
export function useSpHistory(
  account: Address,
  initialDeposit: bigint | undefined,
): { status: HistoryStatus; basis: SpCostBasis | null; retry: () => void } {
  const { network } = useNetwork();
  const query = useQuery({
    queryKey: ["sp-history", network.chainId, account, initialDeposit?.toString()],
    enabled: initialDeposit !== undefined,
    refetchInterval: HISTORY_REFRESH_MS,
    retry: (failures, error) => error instanceof HistoryLagError && failures < LAG_RETRIES,
    retryDelay: LAG_RETRY_MS,
    queryFn: async () => {
      const basis = spCostBasis(spActions(await fetchSpHistoryRows(browserFetchJson, network, account)));
      if (initialDeposit !== undefined && historyLagging(basis, initialDeposit)) {
        throw new HistoryLagError("The explorer has not indexed the latest Stability Pool action yet");
      }
      return basis;
    },
  });
  return {
    status: historyStatus({ hasData: query.data !== undefined, error: query.error, failureReason: query.failureReason }),
    basis: query.data ?? null,
    retry: () => void query.refetch(),
  };
}
```

- [ ] **Step 2: Withdraw and claim sends**

Create `web/src/lib/stability-pool/useSpActions.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import type { ExitPercent } from "@/lib/positions/exit-intent";
import { SP_WITHDRAW_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { submitCall, type SendPin } from "@/lib/tx/send";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { encodeWithdrawCall } from "./calls";
import { spClaimPreview, spWithdrawPreview } from "./preview";
import type { SpData } from "./snapshot";

/**
 * Flow H and the BTC-gain claim: one direct `withdrawFromSP` each (a claim is `withdrawFromSP(0)`).
 * Each send refreshes, re-gates, simulates (a paused pool is decoded and nothing is sent), submits,
 * and hands the hash to the receipt page. Max is recomputed from the fresh compounded deposit.
 */
export function useSpActions(
  account: Address,
  refresh: () => Promise<SpData>,
): { withdraw: (percent: ExitPercent) => void; claim: () => void; pending: "withdraw" | "claim" | null } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const walletKind = useWalletKind();
  const { showError } = useErrorToast();
  const [pending, setPending] = useState<"withdraw" | "claim" | null>(null);

  async function send(kind: "withdraw" | "claim", percent: ExitPercent) {
    const pin: SendPin = { account, chainId: network.chainId };
    setPending(kind);
    try {
      const fresh = await refresh();
      const walletChainId = getAccount(config).chainId;
      let amount = 0n;
      if (kind === "withdraw") {
        const preview = spWithdrawPreview({ network, data: fresh, percent, walletKind: walletKind ?? "unknown", walletChainId });
        if (preview.block?.outcome) throw new BlockedError(preview.block.outcome);
        amount = preview.amount;
      } else {
        const block = spClaimPreview({ network, data: fresh, walletChainId });
        if (block?.outcome) throw new BlockedError(block.outcome);
      }
      await simulateContract(config, {
        address: network.addresses.stabilityPool,
        abi: stabilityPoolAbi,
        functionName: "withdrawFromSP",
        args: [amount],
        account: pin.account,
        chainId: pin.chainId,
      });
      const hash = await submitCall(config, { to: network.addresses.stabilityPool, data: encodeWithdrawCall(amount) }, pin, SP_WITHDRAW_GAS);
      router.push(`/tx/?hash=${hash}`);
    } catch (error) {
      showError(error, { retry: () => void send(kind, percent) });
    } finally {
      setPending(null);
    }
  }

  return {
    withdraw: (percent) => void send("withdraw", percent),
    claim: () => void send("claim", 100),
    pending,
  };
}
```

- [ ] **Step 3: Position card**

Create `web/src/components/stability-pool/SpPositionCard.tsx`:

```tsx
import Link from "next/link";
import { StatRow } from "@/components/dashboard/StatRow";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd, signedMusd } from "@/components/lp/units";
import type { HistoryStatus } from "@/lib/stability-pool/cost-basis";
import type { SpBlock } from "@/lib/stability-pool/gate";
import { spWithdrawQuery } from "@/lib/stability-pool/intent";
import type { SpView } from "@/lib/stability-pool/position";

type History = { status: HistoryStatus; retry: () => void };

/** Flow F, Stability Pool part: deposit, pending BTC gain, what it cost (estimates, never "profit"). */
export function SpPositionCard({
  view,
  history,
  claimBlock,
  onClaim,
  claiming,
}: {
  view: SpView;
  history: History;
  claimBlock: SpBlock | null;
  onClaim: () => void;
  claiming: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Stability Pool</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Deposit now" sub="After absorbed liquidations">
          {musd(view.deposit)}
        </StatRow>
        <StatRow label="Pending BTC gain" sub={`≈ ${musd(view.gainValue)}`}>
          {btc(view.gain)}
        </StatRow>
        <StatRow label="Value now (estimated)" strong>
          {musd(view.value)}
        </StatRow>
        <CostRows view={view} history={history} />
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/positions/stability-pool/withdraw/${spWithdrawQuery(100)}`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
        >
          Withdraw
        </Link>
        <button
          type="button"
          disabled={claimBlock !== null || claiming}
          onClick={onClaim}
          className="rounded-full border border-accent px-5 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          {claiming ? "Check your wallet…" : "Claim BTC gain"}
        </button>
        <BlockNotice block={claimBlock?.reason === "no-gain" ? null : claimBlock} />
      </div>
    </section>
  );
}

function CostRows({ view, history }: { view: SpView; history: History }) {
  if (history.status === "unavailable") {
    return (
      <StatRow label="Cost basis">
        Unavailable{" "}
        <button type="button" onClick={history.retry} className="text-xs font-semibold text-accent hover:underline">
          Retry
        </button>
      </StatRow>
    );
  }
  if (history.status === "updating") return <StatRow label="Cost basis">Updating…</StatRow>;
  if (!view.cost) return <StatRow label="Cost basis">Loading…</StatRow>;
  return (
    <>
      <StatRow label="Cost basis" sub="MUSD you put in, less what you took out">
        {musd(view.cost.basis)}
      </StatRow>
      <StatRow label="Estimated position value change" sub="Value now minus cost basis">
        {signedMusd(view.cost.valueChange)}
      </StatRow>
      <StatRow label="BTC gains received">{btc(view.cost.gainsClaimed)}</StatRow>
      <StatRow label="Absorbed by liquidations">{musd(view.cost.absorbed)}</StatRow>
    </>
  );
}
```

- [ ] **Step 4: Positions page and dashboard summary**

Replace `web/src/components/positions/PositionsPage.tsx`'s `Positions` component (keep the default export and imports; add the new imports `useSpSnapshot`, `useSpHistory`, `useSpActions`, `spView`, `spClaimPreview`, `SpPositionCard`) with:

```tsx
function Positions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { data, error, refresh } = usePositionsSnapshot(account);
  const sp = useSpSnapshot(account);
  const history = usePositionsHistory(account);
  const spHistory = useSpHistory(account, sp.data?.snapshot.initialDeposit);
  const spActions = useSpActions(account, sp.refresh);

  if (!data || !sp.data) {
    const failed = error ?? sp.error;
    return failed ? (
      <LoadError
        error={failed}
        onRetry={() => {
          void refresh().catch(() => undefined);
          void sp.refresh().catch(() => undefined);
        }}
      />
    ) : (
      <div aria-busy="true" aria-label="Loading your positions" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const view = positionView(data.snapshot, history.events ?? null);
  const pool = spView(sp.data.snapshot, spHistory.basis);
  const block = claimBlock({
    network,
    walletChainId: chainId,
    fees: data.snapshot.fees,
    lacksGas: lacksGas(data.gasBalance, data.gasPrice),
  });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <h1 className="text-lg font-semibold">Your positions</h1>
      {view.empty && pool.empty ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm">You have no MUSD/BTC LP, no unclaimed pool fees, and no Stability Pool deposit on {network.name}.</p>
          <div className="mt-3 flex gap-4">
            <Link href="/route/lp/" className="text-xs font-semibold text-accent hover:underline">
              Deposit MUSD into the pool
            </Link>
            <Link href="/route/stability-pool/" className="text-xs font-semibold text-accent hover:underline">
              Back the system in the Stability Pool
            </Link>
          </div>
        </section>
      ) : (
        <>
          {view.lp.balance > 0n && <LpPositionCard lp={view.lp} history={history} />}
          {!view.empty && <FeesCard account={account} fees={view.fees} block={block} />}
          {!pool.empty && (
            <SpPositionCard
              view={pool}
              history={spHistory}
              claimBlock={spClaimPreview({ network, data: sp.data, walletChainId: chainId })}
              onClaim={spActions.claim}
              claiming={spActions.pending === "claim"}
            />
          )}
        </>
      )}
    </>
  );
}
```

Update its doc comment to "Spec §9 screen 5: LP, pool fees, and the Stability Pool." Note `FeesCard` now shows only when there is LP or fees (`!view.empty`), so an SP-only account does not see an empty fees card.

`web/src/components/dashboard/PositionsSummary.tsx`: add a `spValue: bigint` prop; render when the LP view is non-empty **or** `spValue > 0n`; add a row `<StatRow label="Stability Pool (estimated)">{musd(spValue)}</StatRow>` after the fees row; show the LP and fees rows only when `!view.empty`; update the doc comment to "…once there is LP, unclaimed fees, or a Stability Pool deposit." The full component:

```tsx
/** Spec §9 screen 1 "positions summary": shown once there is LP, unclaimed fees, or a Stability Pool deposit. */
export function PositionsSummary({ account, spValue }: { account: Address; spValue: bigint }) {
  const { data } = usePositionsSnapshot(account);
  if (!data) return null;
  const view = positionView(data.snapshot, null);
  if (view.empty && spValue === 0n) return null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Your positions</h2>
        <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
          View positions
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {!view.empty && <StatRow label="MUSD/BTC LP (estimated)">{musd(view.lp.value)}</StatRow>}
        {!view.empty && <StatRow label="Unclaimed pool fees (estimated)">{musd(view.fees.total)}</StatRow>}
        {spValue > 0n && <StatRow label="Stability Pool (estimated)">{musd(spValue)}</StatRow>}
      </dl>
    </section>
  );
}
```

`web/src/components/dashboard/Dashboard.tsx`: import `exposure` from `@/lib/exposure/exposure` and render `<PositionsSummary account={account} spValue={exposure(snapshot).spValue} />`.

- [ ] **Step 5: Test, build**

Run: `cd web && npm test && npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/stability-pool/useSpHistory.ts web/src/lib/stability-pool/useSpActions.ts web/src/components/stability-pool/SpPositionCard.tsx web/src/components/positions/PositionsPage.tsx web/src/components/dashboard/PositionsSummary.tsx web/src/components/dashboard/Dashboard.tsx
git commit -m "feat(web): Stability Pool position with cost basis and BTC-gain claim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Withdraw page

**Files:**
- Create: `web/src/components/stability-pool/SpWithdrawPage.tsx`
- Create: `web/src/app/positions/stability-pool/withdraw/page.tsx`

**Interfaces:**
- Consumes: `useSpSnapshot` (Task 6); `useSpActions` (Task 7); `spWithdrawPreview`, `spClaimPreview` (Task 4); `parseSpWithdrawPercent`, `spWithdrawQuery`; `EXIT_PERCENTS`, `ExitPercent`; `decodeError`; wagmi `useSimulateContract`.
- Produces: page `/positions/stability-pool/withdraw/?percent=`.

- [ ] **Step 1: The page**

Create `web/src/components/stability-pool/SpWithdrawPage.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useSimulateContract } from "wagmi";
import { StatRow } from "@/components/dashboard/StatRow";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { SP_WITHDRAW_BLOCKED } from "@/lib/errors/outcomes";
import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";
import { parseSpWithdrawPercent, spWithdrawQuery } from "@/lib/stability-pool/intent";
import { spClaimPreview, spWithdrawPreview } from "@/lib/stability-pool/preview";
import type { SpData } from "@/lib/stability-pool/snapshot";
import { useSpActions } from "@/lib/stability-pool/useSpActions";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";

const pill = (on: boolean) =>
  on ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted";

/** Spec §9 screen 6b: share or Max, simulated first; a paused pool shows the blocked state with Claim BTC gain. */
export default function SpWithdrawPage() {
  return <RequireWallet>{(account) => <SpWithdraw account={account} />}</RequireWallet>;
}

function SpWithdraw({ account }: { account: Address }) {
  const searchParams = useSearchParams();
  const [percent, setPercent] = useState<ExitPercent>(() => parseSpWithdrawPercent(searchParams));
  const { data, error, refresh } = useSpSnapshot(account);
  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading your deposit" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }
  return (
    <WithdrawView
      account={account}
      data={data}
      refresh={refresh}
      percent={percent}
      onPercent={(next) => {
        setPercent(next);
        window.history.replaceState(null, "", spWithdrawQuery(next));
      }}
    />
  );
}

function WithdrawView(props: {
  account: Address;
  data: SpData;
  refresh: () => Promise<SpData>;
  percent: ExitPercent;
  onPercent: (next: ExitPercent) => void;
}) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const actions = useSpActions(props.account, props.refresh);
  const preview = spWithdrawPreview({ network, data: props.data, percent: props.percent, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const claimBlock = spClaimPreview({ network, data: props.data, walletChainId: chainId });
  // Simulated on load: a pool paused by an under-collateralised Trove is shown before any signing.
  const check = useSimulateContract({
    address: network.addresses.stabilityPool,
    abi: stabilityPoolAbi,
    functionName: "withdrawFromSP",
    args: [preview.amount],
    account: props.account,
    chainId: network.chainId,
    query: { enabled: preview.block === null },
  });
  const paused = check.error !== null && decodeError(check.error, network).kind === SP_WITHDRAW_BLOCKED.kind;
  const busy = actions.pending !== null;

  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Withdraw from the Stability Pool</h1>
        <fieldset className="mt-4" disabled={busy}>
          <legend className="text-sm font-medium">Amount to withdraw</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {EXIT_PERCENTS.map((value) => (
              <button key={value} type="button" aria-pressed={value === props.percent} onClick={() => props.onPercent(value)} className={pill(value === props.percent)}>
                {value === 100 ? "Max" : `${value}%`}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Your deposit: {musd(props.data.snapshot.dashboard.sp.deposit)}</p>
        </fieldset>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <StatRow label="MUSD to withdraw (estimated)" strong>
            {musd(preview.amount)}
          </StatRow>
          <StatRow label="Deposit after">{musd(preview.depositAfter)}</StatRow>
          <StatRow label="BTC gain paid with it">{btc(preview.gainPaid)}</StatRow>
          <StatRow label="MezoRoute fee">None</StatRow>
          <StatRow label="Network fee (estimated)">{preview.gasCost === null ? "—" : btc(preview.gasCost)}</StatRow>
        </dl>
      </section>
      {paused ? (
        <section role="status" className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm text-danger">{SP_WITHDRAW_BLOCKED.message}</p>
          <p className="mt-1 text-xs text-muted">Claiming your BTC gain still works while withdrawals are paused.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={claimBlock !== null || busy}
              onClick={actions.claim}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain"}
            </button>
            <button type="button" onClick={() => void check.refetch()} className="text-xs font-semibold text-accent hover:underline">
              Retry
            </button>
          </div>
        </section>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <BlockNotice block={preview.block} />
          <button
            type="button"
            disabled={preview.block !== null || busy || check.isPending}
            onClick={() => actions.withdraw(props.percent)}
            className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {actions.pending === "withdraw" ? "Check your wallet…" : "Withdraw"}
          </button>
        </div>
      )}
      <Link href="/positions/" className="inline-block text-xs font-semibold text-accent hover:underline">
        Back to positions
      </Link>
    </>
  );
}
```

Note: `check.isPending` is true while the query is disabled in TanStack Query v5; the button is already disabled by `preview.block` in that case, so this only waits for the first simulation when the gate is clear. If the simulation fails for another reason (RPC outage), the button stays enabled and the send's own simulation decodes the error.

Create `web/src/app/positions/stability-pool/withdraw/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const SpWithdrawPage = dynamic(() => import("@/components/stability-pool/SpWithdrawPage"), { ssr: false });

export default function Page() {
  return <SpWithdrawPage />;
}
```

- [ ] **Step 2: Test, build**

Run: `cd web && npm test && npm run build`
Expected: PASS; `out/positions/stability-pool/withdraw/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/stability-pool/SpWithdrawPage.tsx web/src/app/positions/stability-pool
git commit -m "feat(web): Stability Pool withdraw page with the paused-pool state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Live QA, gas budgets, and docs

**Files:**
- Modify: `web/src/lib/quote/gas.ts` (measured budgets)
- Modify: `PRODUCT_SPEC.md` (§12 cost basis and positions data; §16 F5 done line)
- Modify: `CLAUDE.md` (Frontend: an F5 bullet)
- Modify: `docs/superpowers/specs/2026-10-14-f5-stability-pool-design.md` (QA result section)

- [ ] **Step 1: Agent QA on testnet (local export + local signer, deployer account)**

Build, serve `web/out` with `python3 -m http.server` (restart after every rebuild), and drive it with Playwright and the local signer recipe from F7 (memory: QA signer). Check, and record tx hashes:
1. Dashboard "Back the system" → `/route/stability-pool/`; 10 MUSD shows deposit now, pending gain, deposit after, exposure before/after; mainnet shows the read-only notice.
2. Confirm: Approve MUSD → Deposit. Receipt shows "Stability Pool deposit confirmed": 10 MUSD deposited, deposit now = `deposits(deployer)` from `cast call`; MUSD allowance to the pool back to 0.
3. `/positions/`: SP card values equal `cast call getCompoundedMUSDDeposit/getDepositorCollateralGain`; cost basis = an independent recount with `curl` of the explorer API; "Updating…" appears right after the deposit if the explorer lags, then the value; Claim BTC gain disabled with a zero gain.
4. Withdraw 50% then Max: receipts "Stability Pool withdrawal confirmed" with the amounts; deposit after Max = 0; the card disappears.
5. Paused state: with Playwright, route the `eth_call` of `withdrawFromSP` to return the revert string `StabilityPool: Cannot withdraw while there are troves with ICR < MCR` (or stub `useSimulateContract` via a mocked RPC response); the page shows the §13 message with Claim BTC gain and Retry.
6. Unisat mock (`window.unisat`): the confirm page shows "Approve MUSD" first.
7. 360 px width: route, confirm, positions, withdraw pages have no horizontal scroll.

- [ ] **Step 2: Set the gas budgets from the measured transactions**

Read `gasUsed` of the deposit and the withdrawals (`cast receipt <hash> gasUsed --rpc-url https://rpc.test.mezo.org`). Set `SP_DEPOSIT_GAS` and `SP_WITHDRAW_GAS` to the larger measured value of each, rounded up to the next 10,000 plus 10%, and replace the "Provisional" comment with the measured numbers and tx hashes. Run `cd web && npx vitest run src/lib && npm run build`.

- [ ] **Step 3: Docs**

- `PRODUCT_SPEC.md` §12 "Cost basis", Stability Pool bullet → "Stability Pool: cost basis = deposits added, withdrawals removing cost pro rata to the share of the compounded deposit they take (`basis × amount / before`), rebuilt from `UserDepositChanged`/`CollateralGainWithdrawn` history; BTC gains received and MUSD absorbed are shown separately."
- `PRODUCT_SPEC.md` §12 "Positions data": replace the Stability Pool part of the cost-basis-history sentence with "Stability Pool history comes from the explorer's Blockscout API (`api.explorer.test.mezo.org`, `api.explorer.mezo.org`; one request per event filtered by depositor), because the pool's deployment block is millions of blocks behind the head; a history that does not end at `deposits(account)` is treated as indexer lag."
- `PRODUCT_SPEC.md` §16: after the F7 line add "F5 done <date>: Stability Pool deposit (exact approval → `provideToSP`), position with cost basis from the explorer API, BTC-gain claim (`withdrawFromSP(0)`, never paused), and withdraw 25/50/75/Max with the paused-pool state; design in `docs/superpowers/specs/2026-10-14-f5-stability-pool-design.md`."
- `CLAUDE.md` Frontend: add a bullet after F7: "Stability Pool (F5): `/route/stability-pool/?amount=` → `/confirm/`, `/positions/stability-pool/withdraw/?percent=`; all calls go straight to the pool (no executor, no fee, no permit: every wallet approves the exact amount). Claim BTC gain is `withdrawFromSP(0)`, which the pool never pauses. History comes from the explorer's Blockscout API (`network.explorerApiUrl`; `explorer.test.mezo.org` itself serves no API), checked against `deposits(account)` for indexer lag; cost basis removes cost pro rata on withdrawals. Receipts tell deposit/withdraw/claim apart by the MUSD `Transfer` between depositor and pool. Design: `docs/superpowers/specs/2026-10-14-f5-stability-pool-design.md`."
- Spec `2026-10-14-f5-stability-pool-design.md`: add "### QA result (<date>)" under "Done when" with the hashes and checks from Step 1.

- [ ] **Step 4: Final verification**

Run: `cd web && npm test && npm run build`, and `cd contracts && forge test` (no contract change; confirms nothing else moved).
Expected: all pass. `git status` shows no `* 2*` duplicates.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/quote/gas.ts PRODUCT_SPEC.md CLAUDE.md docs/superpowers/specs/2026-10-14-f5-stability-pool-design.md
git commit -m "docs: F5 Stability Pool QA, measured gas, and spec updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: User QA handoff**

Deploy a Vercel preview (`cd web && vercel deploy --yes --build-env NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=…`) and give the user a short checklist: MetaMask deposit → receipt → positions → withdraw 25%.
