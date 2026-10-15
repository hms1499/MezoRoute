# U2 Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page (`/` before a wallet connects) as a dark "route map" page whose hero is a live, wallet-free route simulator on Mezo mainnet data, with the six motion effects approved in brainstorming.

**Architecture:** Pure logic lives in `web/src/lib/landing/`:
- `simulate.ts` computes both routes for any amount from the mainnet reference and its 30-day history.
- `view.ts` turns that into strip and table cells.

The page lives in `web/src/components/landing/`. The dark look is scoped:
- `night` colour tokens for the landing;
- a `SurfaceContext` that turns the shared header and footer dark while the landing is mounted.

Motion is CSS keyframes, gated by `prefers-reduced-motion: no-preference`, plus three small hooks.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, Tailwind 3.4, `next/font/google` (Inter, JetBrains Mono), lucide-react 1.49.0 (already pinned), Vitest 5 (node environment, pure modules only), Playwright with a keyless mock wallet for QA.

**Spec:** `docs/superpowers/specs/2026-10-15-u2-landing-redesign-design.md`

## Global Constraints

**Scope**
- Only the landing changes. The dashboard, route, confirm, receipt, and positions pages keep U1's light design; after a wallet connects, everything is light again.
- No new dependency. Fonts come only through `next/font/google`.
- No transaction, quote, gate, or send logic changes. The only `src/lib` change outside `src/lib/landing/` is `loadMainnetReference`, which also returns `history`.

**Copy rules (`PRODUCT_SPEC.md` §9)**
- "Estimated" or "≈" on every pre-confirmation figure.
- "Past 30 days on Mezo mainnet, not a forecast".
- No annualised Stability Pool figure.
- Never "guaranteed", "risk-free", or MEZO/gauge rewards.
- Mainnet figures are labelled as mainnet on both networks.
- "Unaudited" stays visible.

**Accessibility**
- Every text/background pair is ≥ 4.5:1, enforced by `web/src/lib/ui/contrast.test.ts`.
- Buttons are ≥ 36 px tall (`min-h-9`), primary CTAs ≥ 44 px (`min-h-11`).
- A visible focus ring on the dark background (teal `night.lp`).

**Motion**
- Every animation sits under `@media (prefers-reduced-motion: no-preference)`. Under `reduce`, the hooks return the final values at once.

**Layout and budget**
- No horizontal scroll at 360 px.
- First Load JS for `/` stays within +5 kB of 92 kB.

**Wallet tree rule.** Passport, RainbowKit components, and wagmi hooks are never imported from a module that `app/layout.tsx` or an `app/**/page.tsx` imports statically. The landing renders inside the client-only wallet tree (`Home` → `RequireWallet`), so its components may use them.

**Every commit**
- `cd web && npm test && npm run build` pass.
- Never run `next build` while `next dev` runs.
- If an iCloud `out 2` appears, delete it and rebuild.
- Check `git status` for iCloud duplicates (`* 2.*`) before committing.
- Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Leaving the landing.** Connecting a wallet (or reconnecting after a reload) must return the header and footer to light. The cleanup in `useDarkSurface` handles this. Pinned by the Task 4 QA step "connect from the landing".
2. **Mainnet read failures on the landing.**
   - A failed head read hides the strip and shows "Live data unavailable" in the simulator; the rest of the page stays complete.
   - A failed history read blanks only "Last 30 days".
   - Pinned by `liveStrip`/`simulatorRows` tests (Task 1) and the aborted-RPC QA (Task 4).
3. **Amount input edge cases.**
   - A comma or other invalid text shows the error and keeps the last valid figures.
   - 10,000 MUSD shows the cap note.
   - "0" shows no error and keeps the last figures.
   - Pinned by `simulatorNotes` tests (Task 1) and the simulator QA (Task 4).
4. **360 px simulator table.** Three mono columns, with values like "+0.006222 BTC" and "≈ 836.66 MUSD", must fit without horizontal scroll. Pinned by the 360 px QA in Tasks 4 and 6.
5. **Reduced motion.** No element animates; travelling dots stay hidden; count-ups show final values at once. Pinned by the `countUpAt` duration-0 test (Task 2) and the reduced-motion QA (Task 6).

---

## File Structure

| Path | Responsibility |
|---|---|
| `web/src/lib/reference/load.ts` (+ test) | Also returns `history: RouteHistory \| null` |
| `web/src/lib/landing/simulate.ts` (+ test) | `simulateRoutes`: both routes for an amount from mainnet data |
| `web/src/lib/landing/view.ts` (+ test) | `liveStrip`, `compactMusd`, `simulatorRows`, `simulatorNotes` |
| `web/src/lib/ui/tokens.ts` | `night` colours plus their contrast pairs |
| `web/src/lib/ui/motion.ts` (+ test) | `easeOutCubic`, `interpolateBigint`, `countUpAt` |
| `web/src/components/landing/hooks.ts` | `usePrefersReducedMotion`, `useCountUp`, `useInView` |
| `web/src/components/surface.tsx` | `SurfaceProvider`, `useSurface`, `useDarkSurface` |
| `web/src/components/landing/*.tsx` | `Landing`, `Hero`, `RouteMap`, `Simulator`, `LiveStrip`, `RouteLanes`, `HowItWorks`, `TrustRow`, `FinalCta` |
| Deleted | `components/home/Landing.tsx`, `components/home/LiveCard.tsx`, `lib/reference/landing.ts` (+ test) |

---

### Task 1: Landing data: history, simulator maths, and view cells

**Files:**
- Modify: `web/src/lib/reference/load.ts`, `web/src/lib/reference/load.test.ts`
- Create: `web/src/lib/landing/simulate.ts`, `web/src/lib/landing/simulate.test.ts`, `web/src/lib/landing/view.ts`, `web/src/lib/landing/view.test.ts`, `web/src/lib/landing/test-fixtures.ts`

**Interfaces:**
- Produces:
  - `MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null; history: RouteHistory | null }`
  - `MAINNET_MAX_MUSD_IN: bigint` (1,000 MUSD)
  - `LandingLp = { status: "ok"; positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint; fee: bigint } | { status: "unavailable" }`
  - `LandingSimulation = { amount: bigint; executorFeeBps: bigint; overCap: boolean; lp: LandingLp; sp: { positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint }; backtests: RouteBacktests | null }`
  - `simulateRoutes(input: { reference: MainnetReference; history: RouteHistory | null; amount: bigint; executorFeeBps: bigint }): LandingSimulation`
  - `LiveStrip = { kind: "loading" } | { kind: "hidden" } | { kind: "data"; poolValue: bigint; lpFees: { value: string; sub: string } | null; spDeposits: bigint; spShare: string }`
  - `liveStrip(data: MainnetReferenceData | undefined, error: Error | null): LiveStrip`
  - `compactMusd(value: bigint): string`
  - `SimCell = { kind: "text"; text: string } | { kind: "figure"; value: bigint; format: (value: bigint) => string }`
  - `SimRow = { label: string; lp: SimCell; sp: SimCell; lpTone?: "btc" }`
  - `simulatorRows(sim: LandingSimulation): SimRow[]`
  - `SIMULATOR_FOOTNOTE: string`
  - `simulatorNotes(sim: LandingSimulation, networkId: NetworkId): string[]`

- [ ] **Step 1: Write the failing tests**

Append to `web/src/lib/reference/load.test.ts`, inside `describe("loadMainnetReference", …)`, after the first `it`:

```ts
  it("returns no history when the history read fails", async () => {
    const data = await loadMainnetReference(client({ historyFails: true }));
    expect(data.history).toBeNull();
  });
```

`web/src/lib/landing/test-fixtures.ts` (test data only; shared by the two test files, so neither imports the other and runs its tests twice):

```ts
import type { RouteHistory } from "@/lib/compare/history";

export const ONE = 10n ** 18n;

/** Mainnet-like pool: 101,720 MUSD + 1.25 BTC, oracle at 80,000. */
export const reference = {
  reserveMusd: 101_720n * ONE,
  reserveBtc: 1_250_000_000_000_000_000n,
  lpSupply: 356n * ONE,
  feeBps: 30n,
  price: 80_000n * ONE,
  musdSupply: 29_871_966n * ONE,
  spDeposits: 14_172_031n * ONE,
};
const pool = { reserveMusd: reference.reserveMusd, reserveBtc: reference.reserveBtc, totalSupply: reference.lpSupply, feeBps: 30n };

/** A 30-day window in which the pool's fee index grew and no liquidation reached the Stability Pool. */
export const history: RouteHistory = {
  pastBlock: 100n,
  pastTime: 1_000n,
  headBlock: 200n,
  headTime: 1_000n + 2_592_000n,
  price: 80_000n * ONE,
  pool: { past: { ...pool, indexMusd: 0n, indexBtc: 0n }, now: { ...pool, indexMusd: 10n ** 15n, indexBtc: 0n } },
  sp: {
    past: { P: ONE, S: 0n, epoch: 0n, scale: 0n },
    now: { P: ONE, epoch: 0n, scale: 0n, sumAtPastScale: 0n, sumAtNextScale: 0n },
  },
};
```

`web/src/lib/landing/simulate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareRoutes } from "@/lib/compare/comparison";
import { backtestRoutes } from "@/lib/compare/history";
import { snapshotWith } from "@/lib/dashboard/test-fixtures";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { MAINNET_MAX_MUSD_IN, simulateRoutes } from "./simulate";
import { history, ONE, reference } from "./test-fixtures";

describe("simulateRoutes", () => {
  it("values the LP side exactly like the dashboard comparison for an empty wallet", () => {
    const amount = 1_000n * ONE;
    const sim = simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n });
    const compared = compareRoutes({
      snapshot: snapshotWith({
        lp: { balance: 0n, totalSupply: reference.lpSupply, reserveMusd: reference.reserveMusd, reserveBtc: reference.reserveBtc },
        poolFeeBps: reference.feeBps,
      }),
      amount,
      executorFeeBps: 10n,
    });
    if (sim.lp.status !== "ok" || compared.lp.status !== "ok") throw new Error("expected both quotes");
    expect(sim.lp.positionValue).toBe(compared.lp.positionValue);
    expect(sim.lp.btcAdded).toBe(compared.lp.btcAfter - compared.lp.btcBefore);
    expect(sim.lp.valueAfterDrop).toBe(compared.lp.valueAfterDrop);
    expect(sim.lp.valueAfterDrop).toBe(lpValueAfterDrop(sim.lp.positionValue, 30));
    expect(sim.lp.fee).toBe(compared.lp.fee);
  });

  it("keeps the Stability Pool side in MUSD", () => {
    const sim = simulateRoutes({ reference, history: null, amount: 500n * ONE, executorFeeBps: 10n });
    expect(sim.sp).toEqual({ positionValue: 500n * ONE, btcAdded: 0n, valueAfterDrop: 500n * ONE });
  });

  it("runs the 30-day backtest for the typed amount when the history loaded", () => {
    const amount = 100n * ONE;
    expect(simulateRoutes({ reference, history, amount, executorFeeBps: 10n }).backtests).toEqual(backtestRoutes(history, amount, 10n));
    expect(simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n }).backtests).toBeNull();
  });

  it("marks amounts above the mainnet cap", () => {
    expect(simulateRoutes({ reference, history: null, amount: MAINNET_MAX_MUSD_IN, executorFeeBps: 10n }).overCap).toBe(false);
    expect(simulateRoutes({ reference, history: null, amount: 10_000n * ONE, executorFeeBps: 10n }).overCap).toBe(true);
  });

  it("has no LP quote for an empty pool", () => {
    const sim = simulateRoutes({ reference: { ...reference, reserveMusd: 0n }, history: null, amount: ONE, executorFeeBps: 10n });
    expect(sim.lp).toEqual({ status: "unavailable" });
  });
});
```

`web/src/lib/landing/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatToken } from "@/lib/format";
import { simulateRoutes } from "./simulate";
import { history, ONE, reference } from "./test-fixtures";
import { compactMusd, liveStrip, SIMULATOR_FOOTNOTE, simulatorNotes, simulatorRows } from "./view";

const lpBacktest = { liquidity: 0n, feesMusd: 0n, feesBtc: 0n, feesValue: 0n, valueNow: 0n, feeReturn: 1_300_000_000_000_000n, feeRate: 16_000_000_000_000_000n };
const spBacktest = { depositNow: 0n, btcGain: 0n, valueNow: 0n, gainReturn: 0n, lossReturn: 0n, liquidated: false };
const backtests = { lp: lpBacktest, sp: spBacktest, seconds: 2_592_000n, pastTime: 0n, pastBlock: 0n, headBlock: 0n };

describe("liveStrip", () => {
  it("shows skeletons while the first read runs and hides when it fails", () => {
    expect(liveStrip(undefined, null)).toEqual({ kind: "loading" });
    expect(liveStrip(undefined, new Error("fetch failed"))).toEqual({ kind: "hidden" });
  });

  it("gives the pool value and Stability Pool deposits as numbers to count up", () => {
    expect(liveStrip({ reference, backtests: null, history: null }, null)).toEqual({
      kind: "data",
      poolValue: 201_720n * ONE, // 101,720 + 1.25 × 80,000
      lpFees: null,
      spDeposits: 14_172_031n * ONE,
      spShare: "47.4%",
    });
  });

  it("adds the 30-day LP fees, labelled fees only", () => {
    const strip = liveStrip({ reference, backtests, history: null }, null);
    expect(strip.kind === "data" && strip.lpFees).toEqual({ value: "0.13%", sub: "≈1.6% a year, fees only" });
  });

  it("keeps the figures while a refetch fails", () => {
    expect(liveStrip({ reference, backtests: null, history: null }, new Error("fetch failed")).kind).toBe("data");
  });
});

describe("compactMusd", () => {
  it("shortens millions and groups smaller amounts", () => {
    expect(compactMusd(14_172_031n * ONE)).toBe("14.17M MUSD");
    expect(compactMusd(203_056n * ONE)).toBe("203,056 MUSD");
  });
});

describe("simulatorRows", () => {
  const sim = simulateRoutes({ reference, history: null, amount: 1_000n * ONE, executorFeeBps: 10n });

  it("lists the same five rows for both routes", () => {
    expect(simulatorRows(sim).map((row) => row.label)).toEqual(["Return source", "Last 30 days", "BTC exposure", "If BTC −30%", "MezoRoute fee"]);
  });

  it("gives the LP BTC and the −30% value as figures that can count", () => {
    if (sim.lp.status !== "ok") throw new Error("expected a quote");
    const [, , btc, drop, fee] = simulatorRows(sim);
    expect(btc.lpTone).toBe("btc");
    expect(btc.lp).toMatchObject({ kind: "figure", value: sim.lp.btcAdded });
    expect(btc.lp.kind === "figure" && btc.lp.format(btc.lp.value)).toBe(`+${formatToken(sim.lp.btcAdded)} BTC`);
    expect(drop.lp.kind === "figure" && drop.lp.format(drop.lp.value)).toBe(`≈ ${formatToken(sim.lp.valueAfterDrop, 18, 2)} MUSD`);
    expect(drop.sp.kind === "figure" && drop.sp.format(drop.sp.value)).toBe("1,000 MUSD");
    expect(fee.lp).toEqual({ kind: "text", text: "0.1%" });
    expect(fee.sp).toEqual({ kind: "text", text: "None" });
  });

  it("says Unavailable for the 30-day row without history", () => {
    const [, last30] = simulatorRows(sim);
    expect(last30.lp).toEqual({ kind: "text", text: "Unavailable" });
    expect(last30.sp).toEqual({ kind: "text", text: "Unavailable" });
  });

  it("shows the signed 30-day change, and no liquidations for a quiet Stability Pool", () => {
    const withHistory = simulateRoutes({ reference, history, amount: 1_000n * ONE, executorFeeBps: 10n });
    const [, last30] = simulatorRows(withHistory);
    expect(last30.lp.kind === "text" && last30.lp.text).toMatch(/^[+−][\d,.]+ MUSD \([+−]/);
    expect(last30.sp).toEqual({ kind: "text", text: "No liquidations" });
  });

  it("says the pool quote is unavailable for an empty pool", () => {
    const empty = simulateRoutes({ reference: { ...reference, reserveMusd: 0n }, history: null, amount: ONE, executorFeeBps: 10n });
    const [, , btc] = simulatorRows(empty);
    expect(btc.lp).toEqual({ kind: "text", text: "Pool quote unavailable" });
  });
});

describe("simulatorNotes", () => {
  const at = (amount: bigint) => simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n });

  it("always says the figures are past mainnet data, not a forecast", () => {
    expect(simulatorNotes(at(100n * ONE), "mainnet")).toEqual([SIMULATOR_FOOTNOTE]);
  });

  it("adds the cap note above 1,000 MUSD and the testnet note on testnet", () => {
    const notes = simulatorNotes(at(10_000n * ONE), "testnet");
    expect(notes).toContain("Above the mainnet limit of 1,000 MUSD per transaction.");
    expect(notes).toContain("You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/reference/load.test.ts src/lib/landing`
Expected: FAIL.
- `load.test.ts`: "expected undefined to be null".
- The two landing files: "Cannot find module './simulate'" and "'./view'".

- [ ] **Step 3: Implement**

In `web/src/lib/reference/load.ts`:
- import `type RouteHistory` from `@/lib/compare/history` (next to `RouteBacktests`);
- change the type to:

```ts
export type MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null; history: RouteHistory | null };
```

- add the field to the returned object:

```ts
    history: history.status === "fulfilled" ? history.value : null,
```

`web/src/lib/landing/simulate.ts`:

```ts
import { STRESS_DROP } from "@/lib/compare/comparison";
import { backtestRoutes, type RouteBacktests, type RouteHistory } from "@/lib/compare/history";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import type { MainnetReference } from "@/lib/reference/snapshot";

/** Mainnet's per-transaction entry cap (`contracts/script/Deploy.s.sol` `maxMusdInFor`: 1,000 MUSD). */
export const MAINNET_MAX_MUSD_IN = 1_000n * WAD;

export type LandingLp =
  | { status: "ok"; positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint; fee: bigint }
  | { status: "unavailable" };

export type LandingSimulation = {
  amount: bigint;
  executorFeeBps: bigint;
  overCap: boolean;
  lp: LandingLp;
  sp: { positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint };
  backtests: RouteBacktests | null;
};

/**
 * Both routes for `amount` MUSD from Mezo mainnet data, with no wallet (U2 landing simulator). The LP
 * side follows `compareRoutes` exactly (pool price before the trade); the 30-day rows are F6's backtest.
 */
export function simulateRoutes(input: {
  reference: MainnetReference;
  history: RouteHistory | null;
  amount: bigint;
  executorFeeBps: bigint;
}): LandingSimulation {
  const { reference: r, amount, executorFeeBps } = input;
  const pool = { reserveMusd: r.reserveMusd, reserveBtc: r.reserveBtc, totalSupply: r.lpSupply, feeBps: r.feeBps };
  const quote = quoteEntry(pool, amount, executorFeeBps);
  let lp: LandingLp = { status: "unavailable" };
  if (quote) {
    const shareMusd = (quote.liquidity * quote.after.reserveMusd) / quote.after.totalSupply;
    const shareBtc = (quote.liquidity * quote.after.reserveBtc) / quote.after.totalSupply;
    const positionValue = shareMusd + (shareBtc * pool.reserveMusd) / pool.reserveBtc;
    lp = { status: "ok", positionValue, btcAdded: shareBtc, valueAfterDrop: lpValueAfterDrop(positionValue, STRESS_DROP), fee: quote.fee };
  }
  return {
    amount,
    executorFeeBps,
    overCap: amount > MAINNET_MAX_MUSD_IN,
    lp,
    sp: { positionValue: amount, btcAdded: 0n, valueAfterDrop: amount },
    backtests: input.history ? backtestRoutes(input.history, amount, executorFeeBps) : null,
  };
}
```

`web/src/lib/landing/view.ts`:

```ts
import { STRESS_DROP } from "@/lib/compare/comparison";
import { signedChange } from "@/lib/compare/view";
import type { NetworkId } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { referenceView } from "@/lib/reference/snapshot";
import type { LandingSimulation } from "./simulate";

export type LiveStrip =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "data"; poolValue: bigint; lpFees: { value: string; sub: string } | null; spDeposits: bigint; spShare: string };

/** The landing's live strip: skeletons while loading, nothing on error (the page stays complete). */
export function liveStrip(data: MainnetReferenceData | undefined, error: Error | null): LiveStrip {
  if (data) {
    const view = referenceView(data.reference);
    const lp = data.backtests?.lp;
    const rate = lp ? formatPercent(lp.feeRate, 1) : "";
    return {
      kind: "data",
      poolValue: view.poolTvl,
      lpFees: lp ? { value: formatPercent(lp.feeReturn, 2), sub: `${rate.startsWith("<") ? "" : "≈"}${rate} a year, fees only` } : null,
      spDeposits: data.reference.spDeposits,
      spShare: formatPercent(view.spShare, 1),
    };
  }
  return error ? { kind: "hidden" } : { kind: "loading" };
}

/** "14.17M MUSD" from a million up, otherwise whole MUSD with grouping. */
export function compactMusd(value: bigint): string {
  return value >= 1_000_000n * WAD ? `${formatToken(value, 24, 2)}M MUSD` : `${formatToken(value, 18, 0)} MUSD`;
}

export type SimCell = { kind: "text"; text: string } | { kind: "figure"; value: bigint; format: (value: bigint) => string };
export type SimRow = { label: string; lp: SimCell; sp: SimCell; lpTone?: "btc" };

const text = (value: string): SimCell => ({ kind: "text", text: value });
const figure = (value: bigint, format: (value: bigint) => string): SimCell => ({ kind: "figure", value, format });
const musd = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

/** The simulator table: one row per question, one column per route, so like values line up. */
export function simulatorRows(sim: LandingSimulation): SimRow[] {
  const bt = sim.backtests;
  const quoteMissing = text("Pool quote unavailable");
  return [
    { label: "Return source", lp: text("Swap fees"), sp: text("Liquidation BTC") },
    {
      label: "Last 30 days",
      lp: text(bt?.lp ? signedChange(bt.lp.valueNow, sim.amount) : "Unavailable"),
      sp: text(!bt ? "Unavailable" : bt.sp.liquidated ? signedChange(bt.sp.valueNow, sim.amount) : "No liquidations"),
    },
    {
      label: "BTC exposure",
      lp: sim.lp.status === "ok" ? figure(sim.lp.btcAdded, (v) => `+${formatToken(v)} BTC`) : quoteMissing,
      sp: text("0 BTC"),
      lpTone: "btc",
    },
    {
      label: `If BTC −${STRESS_DROP}%`,
      lp: sim.lp.status === "ok" ? figure(sim.lp.valueAfterDrop, (v) => `≈ ${musd(v)}`) : quoteMissing,
      sp: figure(sim.sp.valueAfterDrop, musd),
    },
    { label: "MezoRoute fee", lp: text(formatBps(sim.executorFeeBps)), sp: text("None") },
  ];
}

export const SIMULATOR_FOOTNOTE =
  "Past 30 days on Mezo mainnet, not a forecast. Estimates in MUSD. Max 1,000 MUSD per transaction on mainnet.";

export function simulatorNotes(sim: LandingSimulation, networkId: NetworkId): string[] {
  const notes = [SIMULATOR_FOOTNOTE];
  if (sim.overCap) notes.push("Above the mainnet limit of 1,000 MUSD per transaction.");
  if (networkId === "testnet") notes.push("You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.");
  return notes;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/reference/load.test.ts src/lib/landing`
Expected: PASS.
- If `drop.sp` formats as "1,000 MUSD" with decimals, `formatToken` dropped the trailing zeros as designed; keep the literal.
- If the 30-day LP regex fails, print `last30.lp`.
  - If it reads "Unavailable", `lpBacktest` found the fixture's pool points invalid: fix the fixture in `test-fixtures.ts` (for example, equal reserves at both points), not the code.
  - Otherwise check `signedChange`'s output shape ("+1.4 MUSD (+0.14%)") and fix only the regex.

- [ ] **Step 5: Verify and commit**

Run: `cd web && npm test && npm run build`. Expected: pass. `MainnetReferenceCard` and `LiveCard` ignore the new field.

```bash
git add web/src/lib/reference/load.ts web/src/lib/reference/load.test.ts web/src/lib/landing
git commit -m "feat(web): landing simulator maths and view cells from mainnet data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Night tokens, mono font, motion helpers, hooks, and CSS

**Files:**
- Modify: `web/src/lib/ui/tokens.ts`, `web/tailwind.config.ts`, `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/src/components/ui/Button.tsx`, `web/src/components/ui/Skeleton.tsx`
- Create: `web/src/lib/ui/motion.ts`, `web/src/lib/ui/motion.test.ts`, `web/src/components/landing/hooks.ts`

**Interfaces:**
- Consumes: `contrastRatio`, `TEXT_PAIRS` (U1).
- Produces:
  - `colors.night = { bg, glow, panel, line, ink, muted, lp, sp, onLp }`. Tailwind classes: `bg-night-bg`, `bg-night-panel`, `border-night-line`, `text-night-ink`, `text-night-muted`, `text-night-lp`, `text-night-sp`, `bg-night-lp`, `text-night-onLp`, `bg-night-glow` (background image), `font-mono`.
  - CSS classes: `landing-dark`, `landing-rise`, `landing-draw`, `landing-travel`, `landing-ping`, `landing-flash`, `landing-reveal`, `landing-fill`.
  - `easeOutCubic(t: number): number`
  - `interpolateBigint(from: bigint, to: bigint, t: number): bigint`
  - `countUpAt(from: bigint, to: bigint, elapsedMs: number, durationMs: number): bigint`
  - `usePrefersReducedMotion(): boolean`
  - `useCountUp(target: bigint, durationMs: number, initial?: bigint): bigint`
  - `useInView<T extends Element>(threshold?: number): [RefObject<T>, boolean]`
  - `ButtonVariant` (exported) gains `"night" | "nightOutline" | "nightGhost"`
  - `Skeleton({ className?, tone?: "light" | "night" })`, `SkeletonCard` unchanged

- [ ] **Step 1: Write the failing tests**

In `web/src/lib/ui/tokens.ts`, append these night pairs to `TEXT_PAIRS`. This is test data, and it references `colors.night`, which does not exist yet:

```ts
  ["night ink on night bg", colors.night.ink, colors.night.bg],
  ["night muted on night bg", colors.night.muted, colors.night.bg],
  ["night ink on night panel", colors.night.ink, colors.night.panel],
  ["night muted on night panel", colors.night.muted, colors.night.panel],
  ["night lp on night bg", colors.night.lp, colors.night.bg],
  ["night lp on night panel", colors.night.lp, colors.night.panel],
  ["night sp on night bg", colors.night.sp, colors.night.bg],
  ["night sp on night panel", colors.night.sp, colors.night.panel],
  ["night on-lp on lp (CTA)", colors.night.onLp, colors.night.lp],
```

`web/src/lib/ui/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countUpAt, easeOutCubic, interpolateBigint } from "./motion";

describe("easeOutCubic", () => {
  it("runs from 0 to 1, fast first, and clamps outside the range", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("interpolateBigint", () => {
  it("lands exactly on both ends, in either direction", () => {
    expect(interpolateBigint(100n, 1_000n, 0)).toBe(100n);
    expect(interpolateBigint(100n, 1_000n, 1)).toBe(1_000n);
    expect(interpolateBigint(1_000n, 100n, 1)).toBe(100n);
    expect(interpolateBigint(0n, 10n ** 24n, 0.5)).toBe(5n * 10n ** 23n);
  });
});

describe("countUpAt", () => {
  it("eases from the start value to the target over the duration", () => {
    expect(countUpAt(0n, 1_000n, 0, 450)).toBe(0n);
    expect(countUpAt(0n, 1_000n, 225, 450)).toBe(875n);
    expect(countUpAt(0n, 1_000n, 450, 450)).toBe(1_000n);
    expect(countUpAt(0n, 1_000n, 9_000, 450)).toBe(1_000n);
  });

  it("shows the target at once with no duration (reduced motion)", () => {
    expect(countUpAt(0n, 1_000n, 0, 0)).toBe(1_000n);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/ui/contrast.test.ts src/lib/ui/motion.test.ts`
Expected: FAIL: "Cannot read properties of undefined (reading 'ink')" (no `colors.night`) and "Cannot find module './motion'".

- [ ] **Step 3: Implement tokens and motion helpers**

In `web/src/lib/ui/tokens.ts`, add inside `colors` (after `btc`):

```ts
  // U2 landing only: a deep teal-black page with the two route colours (LP teal, Stability Pool orange).
  // panel and line are white 5% / 10% over bg, flattened to solid colours so the contrast test can check them.
  night: {
    bg: "#0A1416",
    glow: "#123B3A",
    panel: "#162022",
    line: "#222B2D",
    ink: "#E8F1EF",
    muted: "#9FB3AF",
    lp: "#2DD4BF",
    sp: "#FB923C",
    onLp: "#062221",
  },
```

`web/src/lib/ui/motion.ts`:

```ts
/** Ease-out cubic on 0–1, clamped. */
export function easeOutCubic(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return 1 - (1 - k) ** 3;
}

const STEPS = 1_000_000n;

/** A bigint between `from` and `to` at progress `t` (0–1); exact at both ends. */
export function interpolateBigint(from: bigint, to: bigint, t: number): bigint {
  const k = BigInt(Math.round(Math.min(1, Math.max(0, t)) * Number(STEPS)));
  return from + ((to - from) * k) / STEPS;
}

/** The value a count-up shows `elapsedMs` into a `durationMs` animation; a zero duration shows the target. */
export function countUpAt(from: bigint, to: bigint, elapsedMs: number, durationMs: number): bigint {
  if (durationMs <= 0) return to;
  return interpolateBigint(from, to, easeOutCubic(elapsedMs / durationMs));
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/ui/contrast.test.ts src/lib/ui/motion.test.ts`
Expected: PASS (17 + 9 contrast cases, 5 motion tests). If a night pair fails, darken or lighten that token until it passes. Never lower the 4.5 threshold.

- [ ] **Step 5: Tailwind, font, CSS**

In `web/tailwind.config.ts`, inside `theme.extend`:
- add `backgroundImage`;
- extend `fontFamily`:

```ts
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "night-glow": `radial-gradient(1100px 520px at 25% -5%, ${colors.night.glow} 0%, ${colors.night.bg} 62%)`,
      },
```

In `web/src/app/layout.tsx`:
- import `JetBrains_Mono` beside `Inter`;
- add the font;
- put both variables on `<html>`:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";
```

```tsx
// The landing's figures and labels (U2); self-hosted by next/font like Inter.
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" });
```

```tsx
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
```

Append to `web/src/app/globals.css` (after the `@layer components` block, before the reduced-motion block):

```css
/* U2 landing: focus rings use the landing's teal so they stay visible on the dark page. */
@layer base {
  .landing-dark :focus-visible {
    outline-color: theme("colors.night.lp");
  }
}

/* U2 landing motion. Without the media query every element shows its final state, so reduced
   motion needs no override; travelling dots stay hidden (they only exist while animating). */
.landing-travel {
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .landing-rise {
    animation: landing-rise 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .landing-draw {
    stroke-dasharray: 640;
    animation: landing-draw 1.2s ease-out both;
  }
  .landing-travel {
    animation: landing-travel 3.2s linear infinite both;
  }
  .landing-ping {
    animation: landing-ping 1.8s ease-out infinite;
  }
  .landing-flash {
    animation: landing-flash 700ms ease-out;
  }
  .landing-reveal {
    opacity: 0;
    transform: translateY(18px);
    transition:
      opacity 600ms ease-out,
      transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .landing-reveal[data-seen="true"] {
    opacity: 1;
    transform: none;
  }
  .landing-fill {
    transform: scaleX(0);
    transition: transform 1.4s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .landing-fill[data-seen="true"] {
    transform: scaleX(1);
  }
}

@keyframes landing-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
@keyframes landing-draw {
  from {
    stroke-dashoffset: 640;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes landing-travel {
  0% {
    offset-distance: 0%;
    opacity: 0;
  }
  8%,
  92% {
    opacity: 1;
  }
  100% {
    offset-distance: 100%;
    opacity: 0;
  }
}
@keyframes landing-ping {
  0% {
    box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.6);
  }
  70%,
  100% {
    box-shadow: 0 0 0 8px rgba(45, 212, 191, 0);
  }
}
@keyframes landing-flash {
  from {
    background-color: rgba(45, 212, 191, 0.18);
  }
}
```

- [ ] **Step 6: Button and Skeleton variants**

In `web/src/components/ui/Button.tsx`:
- replace `type Variant = …` with an exported union;
- extend `VARIANTS`;
- use `ButtonVariant` wherever `Variant` was used:

```tsx
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "night" | "nightOutline" | "nightGhost";
```

```tsx
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 active:bg-accent/80",
  secondary: "border border-line bg-white text-accent hover:bg-accent-soft",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "bg-danger text-white hover:bg-danger/90",
  // U2 landing (dark): solid teal, outlined teal, and quiet text.
  night: "bg-night-lp text-night-onLp hover:bg-night-lp/90",
  nightOutline: "border border-night-lp text-night-lp hover:bg-night-lp/10",
  nightGhost: "text-night-muted hover:text-night-ink",
};
```

In `web/src/components/ui/Skeleton.tsx`, replace `Skeleton`:

```tsx
/** A shimmering placeholder (static under reduced motion); `night` for the dark landing. */
export function Skeleton({ className, tone = "light" }: { className?: string; tone?: "light" | "night" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "block rounded-lg bg-[length:200%_100%] motion-safe:animate-shimmer",
        tone === "night" ? "bg-gradient-to-r from-night-line via-night-panel to-night-line" : "bg-gradient-to-r from-line/70 via-white to-line/70",
        className,
      )}
    />
  );
}
```

- [ ] **Step 7: Hooks**

`web/src/components/landing/hooks.ts`:

```ts
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { countUpAt } from "@/lib/ui/motion";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.(REDUCED).matches === true);
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED);
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * A bigint that eases to `target` over `durationMs` whenever `target` changes. It starts at `initial`
 * (default: `target`, so nothing moves on mount). Under reduced motion it is always `target`.
 */
export function useCountUp(target: bigint, durationMs: number, initial?: bigint): bigint {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(initial ?? target);
  const latest = useRef(shown);
  useEffect(() => {
    if (reduced) {
      latest.current = target;
      setShown(target);
      return;
    }
    const from = latest.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const value = countUpAt(from, target, now - start, durationMs);
      latest.current = value;
      setShown(value);
      if (now - start < durationMs) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return reduced ? target : shown;
}

/** True once the element has been `threshold` visible; true at once without IntersectionObserver. */
export function useInView<T extends Element>(threshold = 0.3): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, seen]);
  return [ref, seen];
}
```

- [ ] **Step 8: Verify and commit**

Run: `cd web && npm test && npm run build`
Expected: pass. Nothing uses the new classes yet; the app looks as before.

```bash
git add web/src/lib/ui web/tailwind.config.ts web/src/app/layout.tsx web/src/app/globals.css web/src/components/ui/Button.tsx web/src/components/ui/Skeleton.tsx web/src/components/landing/hooks.ts
git commit -m "feat(web): night tokens, mono font, motion helpers and hooks for the U2 landing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dark chrome on the landing (SurfaceContext)

**Files:**
- Create: `web/src/components/surface.tsx`
- Modify: `web/src/components/AppShell.tsx`, `web/src/components/Header.tsx`, `web/src/components/NetworkSwitch.tsx`, `web/src/components/Footer.tsx`

**Interfaces:**
- Consumes: the `night` classes (Task 2), `ButtonVariant` `nightOutline` (Task 2).
- Produces: `Surface = "light" | "dark"`, `SurfaceProvider({ children })`, `useSurface(): Surface`, `useDarkSurface(): void`. `AppShell` wraps everything in `SurfaceProvider`; its outer wrapper gets `landing-dark bg-night-glow bg-night-bg text-night-ink` while dark.

- [ ] **Step 1: Surface context**

`web/src/components/surface.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Surface = "light" | "dark";

const SurfaceContext = createContext<{ surface: Surface; setSurface: (surface: Surface) => void }>({
  surface: "light",
  setSurface: () => undefined,
});

/** Which look the shared chrome (header, footer, page background) uses: the U2 landing is dark, the app light. */
export function SurfaceProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<Surface>("light");
  const value = useMemo(() => ({ surface, setSurface }), [surface]);
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useSurface(): Surface {
  return useContext(SurfaceContext).surface;
}

/** Turns the chrome dark while the calling component is mounted, and back to light when it unmounts. */
export function useDarkSurface(): void {
  const { setSurface } = useContext(SurfaceContext);
  useEffect(() => {
    setSurface("dark");
    return () => setSurface("light");
  }, [setSurface]);
}
```

- [ ] **Step 2: AppShell**

Replace `web/src/components/AppShell.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";
import { SurfaceProvider, useSurface } from "./surface";

/**
 * The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`).
 * Below 1024 px the bottom padding (after the footer) keeps everything clear of the route pages' fixed action bar.
 * The landing turns the frame dark through `useDarkSurface` (U2).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SurfaceProvider>
      <Frame>{children}</Frame>
    </SurfaceProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const dark = useSurface() === "dark";
  return (
    <div className={cx("min-h-dvh", dark && "landing-dark bg-night-bg bg-night-glow text-night-ink")}>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-24 sm:px-6 lg:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink focus:shadow-raised"
        >
          Skip to content
        </a>
        <Header />
        <MainnetBanner />
        <main id="main" className="mt-4 flex-1 pb-8">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Header, network switch, footer**

In `web/src/components/Header.tsx`:
- add `import { useSurface } from "./surface";`;
- at the top of `Header`, add `const dark = useSurface() === "dark";`;
- in the nav link `className`, replace `current ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink",` with:

```tsx
                current
                  ? dark
                    ? "bg-night-panel text-night-ink"
                    : "bg-white text-ink shadow-card"
                  : dark
                    ? "text-night-muted hover:text-night-ink"
                    : "text-muted hover:text-ink",
```

- change the disconnected button to `<Button size="sm" variant={dark ? "nightOutline" : "primary"} disabled={!mounted} onClick={openConnectModal}>`.

In `web/src/components/NetworkSwitch.tsx`:
- add `import { useSurface } from "./surface";` and `const dark = useSurface() === "dark";`;
- group class: `className={dark ? "flex rounded-full bg-night-panel p-0.5 text-xs" : "flex rounded-full bg-line p-0.5 text-xs"}`;
- the button `className`:

```tsx
            className={
              active
                ? dark
                  ? "rounded-full bg-night-line px-2.5 py-1.5 font-semibold text-night-lp sm:px-3"
                  : "rounded-full bg-white px-2.5 py-1.5 font-semibold text-accent shadow-sm sm:px-3"
                : dark
                  ? "rounded-full px-2.5 py-1.5 text-night-muted hover:text-night-ink sm:px-3"
                  : "rounded-full px-2.5 py-1.5 text-muted hover:text-ink sm:px-3"
            }
```

In `web/src/components/Footer.tsx`:
- add `import { useSurface } from "./surface";` and `const dark = useSurface() === "dark";`;
- footer `className`: `` `mt-12 flex flex-wrap items-center justify-between gap-3 border-t py-6 text-xs ${dark ? "border-night-line text-night-muted" : "border-line text-muted"}` ``;
- each link's hover class: `` dark ? "hover:text-night-lp hover:underline" : "hover:text-accent hover:underline" ``.

`MainnetBanner` stays as it is. Its amber notice reads on both backgrounds, and it is a warning, so it should stand out on the dark landing too.

- [ ] **Step 4: Verify and commit**

Run: `cd web && npm test && npm run build`
Expected: pass. No caller sets dark yet; QA a dashboard page at 1440 and 360 px: unchanged, light.

```bash
git add web/src/components/surface.tsx web/src/components/AppShell.tsx web/src/components/Header.tsx web/src/components/NetworkSwitch.tsx web/src/components/Footer.tsx
git commit -m "feat(web): surface context so the landing can turn the header and footer dark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Landing hero: route map, simulator, live strip

**Files:**
- Create: `web/src/components/landing/{Landing,Hero,RouteMap,Simulator,LiveStrip}.tsx`
- Modify: `web/src/components/home/ConnectCta.tsx`, `web/src/components/home/Home.tsx`
- Delete: `web/src/components/home/Landing.tsx`, `web/src/components/home/LiveCard.tsx`, `web/src/lib/reference/landing.ts`, `web/src/lib/reference/landing.test.ts`

**Interfaces:**
- Consumes:
  - `useMainnetReference(true)`, `MainnetReferenceData`;
  - `simulateRoutes`, `simulatorRows`, `simulatorNotes`, `liveStrip`, `compactMusd`, `SimCell`, `LiveStrip` (Task 1);
  - `useCountUp`, `useInView` (Task 2);
  - `useDarkSurface` (Task 3);
  - `Skeleton tone="night"`, `buttonClass("nightGhost")`.
- Produces:
  - `Highlight = "lp" | "sp" | null`
  - `Landing()`
  - `Hero({ data, error, highlight, onHighlight })`
  - `RouteMap({ highlight, className? })`
  - `Simulator({ data, error, onHighlight })`
  - `LiveStrip({ live })`
  - `ConnectCta({ label?, variant?: "primary" | "night" | "nightOutline", className? })`

- [ ] **Step 1: ConnectCta variants**

Replace `web/src/components/home/ConnectCta.tsx`:

```tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ConnectCta({
  label = "Connect a Bitcoin or EVM wallet",
  variant = "primary",
  className,
}: {
  label?: string;
  variant?: "primary" | "night" | "nightOutline";
  className?: string;
}) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Button variant={variant} disabled={!mounted} onClick={openConnectModal} className={className}>
          <Wallet aria-hidden className="h-4 w-4" />
          {label}
        </Button>
      )}
    </ConnectButton.Custom>
  );
}
```

- [ ] **Step 2: Route map**

`web/src/components/landing/RouteMap.tsx`:

```tsx
"use client";

import { useId } from "react";
import { colors } from "@/lib/ui/tokens";
import { cx } from "@/lib/ui/cx";
import type { Highlight } from "./Landing";

const LP_PATH = "M14 110 C 120 110, 150 40, 260 40 S 400 30, 470 26";
const SP_PATH = "M14 110 C 120 110, 160 140, 270 140 S 410 140, 470 138";

/** MUSD splitting into the two routes (U2 signature). Decorative: the simulator carries the meaning. */
export function RouteMap({ highlight, className }: { highlight: Highlight; className?: string }) {
  const maskId = `sp-reveal-${useId().replace(/:/g, "")}`;
  const glow = (route: "lp" | "sp") => (highlight === route ? `drop-shadow(0 0 6px ${colors.night[route]})` : undefined);
  return (
    <svg viewBox="0 0 480 160" aria-hidden className={cx("w-full overflow-visible", className)}>
      <defs>
        {/* The dashed Stability Pool line is revealed by a solid stroke drawing in underneath it. */}
        <mask id={maskId}>
          <path d={SP_PATH} fill="none" stroke="white" strokeWidth={8} className="landing-draw" style={{ animationDelay: "550ms" }} />
        </mask>
      </defs>
      <path
        d={LP_PATH}
        fill="none"
        stroke={colors.night.lp}
        strokeWidth={highlight === "lp" ? 4 : 2.5}
        strokeLinecap="round"
        className="landing-draw transition-[stroke-width] duration-200"
        style={{ animationDelay: "350ms", filter: glow("lp") }}
      />
      <path
        d={SP_PATH}
        fill="none"
        stroke={colors.night.sp}
        strokeWidth={highlight === "sp" ? 4 : 2.5}
        strokeDasharray="6 7"
        mask={`url(#${maskId})`}
        className="transition-[stroke-width] duration-200"
        style={{ filter: glow("sp") }}
      />
      <circle cx="14" cy="110" r="6" fill={colors.night.ink} />
      <circle r="4" fill={colors.night.lp} className="landing-travel" style={{ offsetPath: `path("${LP_PATH}")`, animationDelay: "1.6s" }} />
      <circle
        r="4"
        fill={colors.night.sp}
        className="landing-travel"
        style={{ offsetPath: `path("${SP_PATH}")`, animationDelay: "2s", animationDuration: "4.4s" }}
      />
      <text x="2" y="96" fill={colors.night.muted} fontSize="11" fontFamily="var(--font-mono)">
        MUSD
      </text>
      <text x="330" y="18" fill={colors.night.lp} fontSize="11" fontFamily="var(--font-mono)">
        LP
      </text>
      <text x="350" y="128" fill={colors.night.sp} fontSize="11" fontFamily="var(--font-mono)">
        SP
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: Simulator**

`web/src/components/landing/Simulator.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { Skeleton } from "@/components/ui/Skeleton";
import { amountState } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import { simulateRoutes } from "@/lib/landing/simulate";
import { simulatorNotes, simulatorRows, type SimCell } from "@/lib/landing/view";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { cx } from "@/lib/ui/cx";
import { useCountUp } from "./hooks";
import type { Highlight } from "./Landing";

const PRESETS = [100n, 500n, 1_000n];
const DEFAULT_AMOUNT = 1_000n * WAD;
const EXECUTOR_FEE_BPS = networks.mainnet.executor?.feeBps ?? 0n;

/** U2 hero: both routes for a typed amount on live Mezo mainnet data, no wallet needed. */
export function Simulator({
  data,
  error,
  onHighlight,
}: {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  onHighlight: (highlight: Highlight) => void;
}) {
  const { network } = useNetwork();
  const [text, setText] = useState("1000");
  const lastValid = useRef(DEFAULT_AMOUNT);
  const { amount, error: amountError } = amountState(text);
  if (amount !== null) lastValid.current = amount;
  const shown = amount ?? lastValid.current;
  const sim = data ? simulateRoutes({ reference: data.reference, history: data.history, amount: shown, executorFeeBps: EXECUTOR_FEE_BPS }) : null;
  const column = (route: "lp" | "sp") => ({ onMouseEnter: () => onHighlight(route), onMouseLeave: () => onHighlight(null) });

  return (
    <section aria-labelledby="simulator-heading" className="rounded-2xl border border-night-line bg-night-panel p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-night-muted">
        <h2 id="simulator-heading">simulate · no wallet needed</h2>
        <span className="inline-flex items-center gap-2 text-night-lp">
          <span aria-hidden className="landing-ping h-2 w-2 rounded-full bg-night-lp" />
          Mezo mainnet
        </span>
      </div>

      <label htmlFor="simulator-amount" className="sr-only">
        Amount in MUSD
      </label>
      <div className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-night-line bg-night-bg px-3 focus-within:ring-2 focus-within:ring-night-lp">
        <input
          id="simulator-amount"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="simulator-notes"
          aria-invalid={amountError ? true : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 font-mono text-2xl font-semibold text-night-ink outline-none"
        />
        <span className="font-mono text-xs text-night-muted">MUSD</span>
      </div>
      {amountError && (
        <p role="alert" className="mt-2 text-sm text-night-sp">
          {amountError}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {PRESETS.map((preset) => {
          const on = amount === preset * WAD;
          return (
            <button
              key={preset.toString()}
              type="button"
              aria-pressed={on}
              onClick={() => setText(preset.toString())}
              className={cx(
                "min-h-9 rounded-full border px-3.5 font-mono text-xs transition-colors duration-150",
                on ? "border-night-lp text-night-lp" : "border-night-line text-night-muted hover:text-night-ink",
              )}
            >
              {formatToken(preset * WAD, 18, 0)}
            </button>
          );
        })}
      </div>

      {sim ? (
        <>
          <table className={cx("mt-4 w-full font-mono text-xs", amount === null && "opacity-70")}>
            <caption className="sr-only">Both routes for {formatToken(shown, 18, 2)} MUSD, estimated</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Detail</span>
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold text-night-lp" {...column("lp")}>
                  MUSD/BTC LP
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold text-night-sp" {...column("sp")}>
                  Stability Pool
                </th>
              </tr>
            </thead>
            <tbody>
              {simulatorRows(sim).map((row) => (
                <tr key={row.label} className="border-t border-night-line">
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal text-night-muted">
                    {row.label}
                  </th>
                  <td className={cx("py-2.5 pl-2 text-right [overflow-wrap:anywhere]", row.lpTone === "btc" ? "text-night-sp" : "text-night-ink")} {...column("lp")}>
                    <Cell cell={row.lp} />
                  </td>
                  <td className="py-2.5 pl-2 text-right text-night-ink [overflow-wrap:anywhere]" {...column("sp")}>
                    <Cell cell={row.sp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul id="simulator-notes" className="mt-3 space-y-1 text-xs leading-relaxed text-night-muted">
            {simulatorNotes(sim, network.id).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      ) : error ? (
        <div role="status" className="mt-4 rounded-xl border border-night-line p-4 text-sm">
          <p className="font-semibold text-night-ink">Live data unavailable</p>
          <p id="simulator-notes" className="mt-1 text-night-muted">
            Mezo mainnet could not be read just now. Connect a wallet to compare the routes on your network.
          </p>
        </div>
      ) : (
        <div role="status" aria-busy="true" aria-label="Loading mainnet figures" className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} tone="night" className="h-5 w-full" />
          ))}
          <span id="simulator-notes" className="sr-only">
            Loading Mezo mainnet figures
          </span>
        </div>
      )}

      <ConnectCta variant="nightOutline" label="Connect wallet to choose a route" className="mt-5 w-full" />
    </section>
  );
}

function Cell({ cell }: { cell: SimCell }) {
  if (cell.kind === "text") return <>{cell.text}</>;
  return <CountingFigure value={cell.value} format={cell.format} />;
}

/** Counts to a new value and flashes once (the key remounts the span to replay the flash). */
function CountingFigure({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  const shown = useCountUp(value, 450);
  return (
    <span key={value.toString()} className="landing-flash rounded px-0.5">
      {format(shown)}
    </span>
  );
}
```

- [ ] **Step 4: Live strip**

`web/src/components/landing/LiveStrip.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import { compactMusd, type LiveStrip as Strip } from "@/lib/landing/view";
import { useCountUp } from "./hooks";

const executor = networks.mainnet.executor;

/** Mezo mainnet today, in mono: counted up once when the data arrives; absent when the read failed. */
export function LiveStrip({ live }: { live: Strip }) {
  if (live.kind === "hidden") return null;
  return (
    <section aria-label="Mezo mainnet today" className="grid grid-cols-2 border-y border-night-line font-mono sm:grid-cols-4">
      {live.kind === "loading" ? (
        [0, 1, 2, 3].map((key) => (
          <div key={key} role={key === 0 ? "status" : undefined} aria-label={key === 0 ? "Loading mainnet figures" : undefined} className="py-4 pr-4">
            <Skeleton tone="night" className="h-3 w-20" />
            <Skeleton tone="night" className="mt-2 h-6 w-28" />
          </div>
        ))
      ) : (
        <>
          <Item label="pool value">
            <CountFromZero value={live.poolValue} format={(v) => `${formatToken(v, 18, 0)} MUSD`} />
          </Item>
          <Item label="LP fees · 30d" sub={live.lpFees?.sub}>
            {live.lpFees?.value ?? "Unavailable"}
          </Item>
          <Item label="stability pool" sub={`${live.spShare} of MUSD supply`}>
            <CountFromZero value={live.spDeposits} format={compactMusd} />
          </Item>
          <Item label="executor">
            {executor ? (
              <a
                href={explorerAddressUrl(networks.mainnet, executor.address)}
                target="_blank"
                rel="noreferrer"
                className="text-night-lp underline-offset-4 hover:underline"
              >
                verified ✓
              </a>
            ) : (
              "not deployed"
            )}
          </Item>
        </>
      )}
    </section>
  );
}

function Item({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="py-4 pr-4">
      <p className="text-xs text-night-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-night-ink sm:text-xl">{children}</p>
      {sub && <p className="text-xs text-night-muted">{sub}</p>}
    </div>
  );
}

function CountFromZero({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  return <>{format(useCountUp(value, 1_100, 0n))}</>;
}
```

- [ ] **Step 5: Hero and Landing shell**

`web/src/components/landing/Hero.tsx`:

```tsx
"use client";

import { ArrowDown } from "lucide-react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { buttonClass } from "@/components/ui/Button";
import type { MainnetReferenceData } from "@/lib/reference/load";
import type { Highlight } from "./Landing";
import { RouteMap } from "./RouteMap";
import { Simulator } from "./Simulator";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero({
  data,
  error,
  highlight,
  onHighlight,
}: {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
}) {
  return (
    <section className="grid grid-cols-1 items-start gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-14">
      <div>
        <p className="landing-rise font-mono text-xs text-night-lp">{"// route planner for MUSD on Mezo"}</p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.04] tracking-tight text-night-ink sm:text-5xl">
          <span className="landing-rise block" style={delay(80)}>
            Pick a route.
          </span>
          <span className="landing-rise block" style={delay(160)}>
            Know the BTC risk.
          </span>
        </h1>
        <p className="landing-rise mt-4 max-w-md text-base leading-relaxed text-night-muted" style={delay(240)}>
          Compare the MUSD/BTC pool with the Stability Pool on live Mezo data, preview the exact transaction, and exit
          back to MUSD. Non-custodial.
        </p>
        <div className="landing-rise mt-6 flex flex-wrap items-center gap-3" style={delay(320)}>
          <ConnectCta variant="night" />
          <a href="#how-it-works" className={buttonClass("nightGhost")}>
            How it works
            <ArrowDown aria-hidden className="h-4 w-4" />
          </a>
        </div>
        <RouteMap highlight={highlight} className="mt-8 hidden lg:block" />
      </div>
      <div className="landing-rise" style={delay(450)}>
        <Simulator data={data} error={error} onHighlight={onHighlight} />
      </div>
      <RouteMap highlight={highlight} className="lg:hidden" />
    </section>
  );
}
```

`web/src/components/landing/Landing.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useDarkSurface } from "@/components/surface";
import { liveStrip } from "@/lib/landing/view";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { Hero } from "./Hero";
import { LiveStrip } from "./LiveStrip";

export type Highlight = "lp" | "sp" | null;

/** The first screen before a wallet connects (U2): dark route map, live simulator, and the story below it. */
export function Landing() {
  useDarkSurface();
  const { data, error } = useMainnetReference(true);
  const [highlight, setHighlight] = useState<Highlight>(null);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Hero data={data} error={error} highlight={highlight} onHighlight={setHighlight} />
      <LiveStrip live={liveStrip(data, error)} />
    </div>
  );
}
```

In `web/src/components/home/Home.tsx`, change the import to `import { Landing } from "@/components/landing/Landing";`.

Delete the old landing and its data helper:

```bash
git rm -q web/src/components/home/Landing.tsx web/src/components/home/LiveCard.tsx web/src/lib/reference/landing.ts web/src/lib/reference/landing.test.ts
grep -rn "home/Landing\|LiveCard\|reference/landing" web/src ; echo "exit $?"
```

Expected: the grep prints nothing and `exit 1`.

- [ ] **Step 6: Verify and QA**

Run: `cd web && npm test && npm run build`
Expected: pass. Test count = previous total − 5 (`landingLive`) + Task 1 and 2 additions. Note First Load JS for `/` (≤ 97 kB).

QA: serve `web/out`; Playwright, no wallet; testnet and mainnet:
- **1440 px:** dark page; header and footer dark; headline, CTA, route map under the copy; simulator on the right showing five rows for 1,000 MUSD, plus the strip below.
- **360 px:**
  - `scrollWidth ≤ 360`;
  - simulator after the CTA, route map after the simulator;
  - table fits; header on one row.
- **Simulator input:**
  - Click 100 and 500: the figures change and flash.
  - Type `10000`: the cap note appears.
  - Type `20,5`: the error appears and the table dims, keeping the last figures.
  - Type `0`: no error.
- **Testnet:** the note "You're on Testnet: …" is present.
- **Delay mainnet POSTs by 5 s** (`rpc-internal.mezo.org`): skeletons in the simulator and the strip.
- **Abort mainnet POSTs:** "Live data unavailable" in the simulator; no strip; the page is otherwise complete.
- **Connect from the landing** (mock wallet → Connect → MetaMask): the dashboard renders, and the header and footer are light again.

- [ ] **Step 7: Commit**

```bash
git add -A web/src
git commit -m "feat(web): dark landing hero with route map, live simulator, and mainnet strip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lower sections: routes, how it works, trust, final CTA

**Files:**
- Create: `web/src/components/landing/{RouteLanes,HowItWorks,TrustRow,FinalCta}.tsx`
- Modify: `web/src/components/landing/Landing.tsx`

**Interfaces:**
- Consumes: `useInView` (Task 2); `Highlight` (Task 4); `ConnectCta` (Task 4); `LP_RETURN_SOURCE`, `LP_RISKS`, `SP_RETURN_SOURCE`, `SP_RISKS` (`src/lib/routes/copy.ts`); `explorerAddressUrl`, `networks`.
- Produces: `RouteLanes({ onHighlight })`, `HowItWorks()`, `TrustRow()`, `FinalCta()`.

- [ ] **Step 1: Route lanes**

`web/src/components/landing/RouteLanes.tsx`:

```tsx
"use client";

import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { cx } from "@/lib/ui/cx";
import { useInView } from "./hooks";
import type { Highlight } from "./Landing";

export function RouteLanes({ onHighlight }: { onHighlight: (highlight: Highlight) => void }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="routes-heading" className="landing-reveal border-t border-night-line py-14">
      <p className="font-mono text-xs text-night-lp">{"// two routes"}</p>
      <h2 id="routes-heading" className="mt-2 text-2xl font-semibold tracking-tight text-night-ink">
        Where your MUSD goes, and what it does to your BTC
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Lane
          route="lp"
          label="route_01 · MUSD/BTC LP"
          title="Earn swap fees"
          source={LP_RETURN_SOURCE}
          risk={LP_RISKS[0]}
          txs="enter: 1 tx (+ permit or approval) · exit: 1 tx → MUSD"
          onHighlight={onHighlight}
        />
        <Lane
          route="sp"
          label="route_02 · Stability Pool"
          title="Back the system"
          source={SP_RETURN_SOURCE}
          risk={SP_RISKS[0]}
          txs="enter: approve + deposit · exit: withdraw"
          onHighlight={onHighlight}
        />
      </div>
    </section>
  );
}

function Lane(props: {
  route: "lp" | "sp";
  label: string;
  title: string;
  source: string;
  risk: string;
  txs: string;
  onHighlight: (highlight: Highlight) => void;
}) {
  const lp = props.route === "lp";
  return (
    <article
      onMouseEnter={() => props.onHighlight(props.route)}
      onMouseLeave={() => props.onHighlight(null)}
      className={cx(
        "rounded-2xl border border-l-4 border-night-line bg-night-panel p-5 transition duration-200 hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] motion-safe:hover:-translate-y-0.5",
        lp ? "border-l-night-lp" : "border-l-night-sp",
      )}
    >
      <p className={cx("font-mono text-xs", lp ? "text-night-lp" : "text-night-sp")}>{props.label}</p>
      <h3 className="mt-1.5 text-lg font-semibold text-night-ink">{props.title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-night-muted">Return source</dt>
          <dd className="text-night-ink">{props.source}</dd>
        </div>
        <div>
          <dt className="text-xs text-night-muted">Main risk</dt>
          <dd className="text-night-ink">{props.risk}</dd>
        </div>
      </dl>
      <p className="mt-4 font-mono text-xs text-night-muted">{props.txs}</p>
    </article>
  );
}
```

- [ ] **Step 2: How it works, trust, final CTA**

`web/src/components/landing/HowItWorks.tsx`:

```tsx
"use client";

import { useInView } from "./hooks";

const STEPS = [
  { n: "01", title: "compare", detail: "Both routes for one amount: fees, BTC exposure, and the last 30 days on chain." },
  { n: "02", title: "preview", detail: "Exact amounts and minimums from one block, with a live quote timer." },
  {
    n: "03",
    title: "sign & exit",
    detail: "One transaction each way after an approval where your wallet needs one; exit back to MUSD from Positions.",
  },
];

export function HowItWorks() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      id="how-it-works"
      data-seen={seen}
      aria-labelledby="how-heading"
      className="landing-reveal scroll-mt-6 border-t border-night-line py-14"
    >
      <p className="font-mono text-xs text-night-lp">{"// how it works"}</p>
      <h2 id="how-heading" className="mt-2 text-2xl font-semibold tracking-tight text-night-ink">
        Three steps, every number shown before you sign
      </h2>
      <div aria-hidden className="relative mt-8 hidden h-px bg-night-line sm:block">
        <span data-seen={seen} className="landing-fill absolute inset-0 origin-left bg-night-lp" />
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n}>
            <p className="font-mono text-sm text-night-ink">
              <span className="text-night-lp">{step.n}</span> {step.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-night-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`web/src/components/landing/TrustRow.tsx`:

```tsx
"use client";

import { BadgeCheck, Lock, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { useInView } from "./hooks";

const executor = networks.mainnet.executor;

export function TrustRow() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="trust-heading" className="landing-reveal border-t border-night-line py-14">
      <p id="trust-heading" className="font-mono text-xs text-night-lp">
        {"// trust"}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Item icon={Lock} title="Non-custodial">
          Funds never sit in MezoRoute between transactions.
        </Item>
        <Item icon={BadgeCheck} title="Source-verified">
          {executor ? (
            <a href={explorerAddressUrl(networks.mainnet, executor.address)} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-night-lp">
              Executor on the Mezo explorer
            </a>
          ) : (
            "Executor source on the Mezo explorer"
          )}
          , no admin keys.
        </Item>
        <Item icon={ShieldCheck} title="Capped">
          Max 1,000 MUSD per transaction on mainnet.
        </Item>
        <Item icon={TriangleAlert} title="Unaudited" warn>
          Hackathon software. Use small amounts.
        </Item>
      </ul>
    </section>
  );
}

function Item({ icon: Icon, title, warn = false, children }: { icon: LucideIcon; title: string; warn?: boolean; children: ReactNode }) {
  return (
    <li>
      <p className={warn ? "inline-flex items-center gap-2 font-semibold text-night-sp" : "inline-flex items-center gap-2 font-semibold text-night-ink"}>
        <Icon aria-hidden className="h-4 w-4" />
        {title}
      </p>
      <p className="mt-1 leading-relaxed text-night-muted">{children}</p>
    </li>
  );
}
```

`web/src/components/landing/FinalCta.tsx`:

```tsx
"use client";

import { ConnectCta } from "@/components/home/ConnectCta";
import { useInView } from "./hooks";

export function FinalCta() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="final-heading" className="landing-reveal border-t border-night-line py-16 text-center">
      <h2 id="final-heading" className="text-3xl font-semibold tracking-tight text-night-ink [text-wrap:balance]">
        Bitcoin wallet or EVM wallet, same routes.
      </h2>
      <div className="mt-6 flex justify-center">
        <ConnectCta variant="night" />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Assemble**

In `web/src/components/landing/Landing.tsx`:
- add the imports `import { FinalCta } from "./FinalCta"; import { HowItWorks } from "./HowItWorks"; import { RouteLanes } from "./RouteLanes"; import { TrustRow } from "./TrustRow";`;
- render after `<LiveStrip …/>`:

```tsx
      <RouteLanes onHighlight={setHighlight} />
      <HowItWorks />
      <TrustRow />
      <FinalCta />
```

- [ ] **Step 4: Verify, QA, commit**

Run: `cd web && npm test && npm run build`
Expected: pass.

QA at 1440 and 360 px, no wallet:
- sections appear as they scroll into view;
- the timeline fills;
- hovering a lane lifts it and highlights its route line in the hero (1440);
- "How it works ↓" scrolls to the section;
- `scrollWidth ≤ innerWidth`.

```bash
git add web/src/components/landing
git commit -m "feat(web): landing route lanes, how it works, trust row, and final CTA with scroll reveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Full QA, docs, status

**Files:**
- Modify: `PRODUCT_SPEC.md` (§9, §16), `AGENTS.md` (Frontend design-system bullet), `docs/STATUS.md`, `docs/superpowers/specs/2026-10-15-u2-landing-redesign-design.md` (QA result)

- [ ] **Step 1: Verify**

Run: `cd web && npm test && npm run build && cd ../contracts && forge fmt --check`
Expected: all pass. First Load JS for `/` ≤ 97 kB.

- [ ] **Step 2: Full landing QA (Playwright, mock wallet recipe in `docs/STATUS.md`)**

**Widths.** `/` without a wallet, on testnet and mainnet, at 360 / 768 / 1024 / 1440 px:
- screenshots;
- `document.documentElement.scrollWidth <= innerWidth`;
- the header is one row.

**Reduced motion** (`page.emulateMedia({ reducedMotion: "reduce" })`):
- no element has a computed `animationName` other than `none`;
- `.landing-travel` circles have opacity 0;
- `.landing-reveal` sections are visible without scrolling;
- simulator figures change immediately on a preset click.

**Keyboard**, Tab from the top:
- skip link, logo, nav, network switch, Connect, CTA, How it works, amount input, presets, simulator Connect, executor link, lower CTA, footer links;
- every stop shows a teal focus ring on the dark page.

**Failure modes:**
- delayed mainnet POSTs → skeletons;
- aborted mainnet POSTs → "Live data unavailable", no strip, complete page;
- aborted history reads only (non-`latest` `eth_call` with a block number) → only "Last 30 days" says "Unavailable".

**Leaving the landing.** Connect with the mock wallet; the dashboard is light again, and so are the header and footer.

**Regression.** The dashboard, route, and positions pages at 360 and 1440 px are unchanged from U1 (light, no overflow).

Fix any bug with a failing test first when the cause is in a pure module; commit fixes separately as `fix(web): …`.

- [ ] **Step 3: Docs**

- **`PRODUCT_SPEC.md` §9**, after the U1 sentence in "Visual direction", append: "U2 (Oct 2026): the landing page before a wallet connects is dark (route-map signature, live wallet-free simulator on Mezo mainnet data, mono figures); the connected app stays light."
- **`PRODUCT_SPEC.md` §16**, after the U1 done line: `U2 done <date>: dark landing with route map, live mainnet route simulator, live strip, route lanes, how it works, trust row; CSS motion gated by reduced motion; design in docs/superpowers/specs/2026-10-15-u2-landing-redesign-design.md.`
- **`AGENTS.md`**, design-system bullet, append: "The landing (U2) uses `night` tokens and the `landing-*` motion classes in `globals.css` (all inside `prefers-reduced-motion: no-preference`); it turns the shared header and footer dark with `useDarkSurface` (`src/components/surface.tsx`), which resets on unmount. Its simulator maths is `src/lib/landing/simulate.ts` (pinned to `compareRoutes` by a parity test)."
- **`docs/STATUS.md`:** add a U2 row (Done, date) above V1; add a session log line; keep "Next: V1".
- **The U2 spec:** append `### QA result (<date>): agent run passed`, listing what each check showed.

- [ ] **Step 4: Commit**

```bash
git add PRODUCT_SPEC.md AGENTS.md docs/STATUS.md docs/superpowers/specs/2026-10-15-u2-landing-redesign-design.md
git commit -m "docs: U2 done: dark landing, QA result, spec and agent guide updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final whole-branch review, then hand back**

Request the final review (superpowers:requesting-code-review) over `main..feat/u2-landing-redesign`. Merge into `main` and push only when the user asks.
