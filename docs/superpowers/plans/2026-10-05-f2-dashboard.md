# F2 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace F1's wallet card with the dashboard: a readiness state, a Trove card, and an exposure panel with 10/20/30% BTC drawdown scenarios, on Testnet and (read-only) Mainnet.

**Architecture:**

- **Reads.** All contract reads go out as one multicall snapshot at one block (`useReadContracts`, every call pinned to the selected network's chain). Separate queries fetch the BTC gas balance and the gas price.
- **Logic.** Pure modules compute from the snapshot and are unit-tested:
  - `lib/math`;
  - `lib/dashboard/snapshot`, `readiness`, `view`;
  - `lib/trove/health`;
  - `lib/exposure`.
- **UI.** Thin React components in `components/dashboard/`, checked by build, lint, and manual QA.

**Tech Stack:** Next.js 14.2.35 (static export), React 18.3.1, `@mezo-org/passport` 0.17.2, RainbowKit 2.0.2, wagmi 2.19.5, viem 2.57.2, TanStack Query 5, Tailwind 3, Vitest 5, TypeScript 5.9.

**Spec:** `docs/superpowers/specs/2026-10-05-f2-dashboard-design.md`. Read it first; it holds the chain facts verified on 5 Oct 2026. Product context: `PRODUCT_SPEC.md` §7 Flow A, §9, §12 "Exposure model", §13.

## Global Constraints

**Workspace and git**

- Work in `/Users/vanhuy/Desktop/mezoroute` on branch `feat/f2-dashboard` (already created; it holds the spec commit `7b3d8ec`). No worktree: `web/node_modules` is large and iCloud-managed.
- Run `git branch --show-current` before each commit.
- Commits use conventional prefixes (`feat(web):`, `fix(web):`, `test(web):`, `docs:`) and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Stage explicit paths only (never `git add -A`). The iCloud Desktop spawns duplicates like `web/src/lib/format 2.ts`; `git status` must show none before committing.

**Dependencies and imports**

- No dependency changes. Next 14.2.35, React 18.3.1, `@mezo-org/passport` 0.17.2, RainbowKit 2.0.2, wagmi 2.19.5, and viem 2.57.2 stay pinned.
- Never import Passport, RainbowKit components, or wagmi hooks from a module that `layout.tsx` or `page.tsx` import statically. `page.tsx` already loads `components/home/Home` through `next/dynamic` with `ssr: false`; everything below `Home` is client-only.
- Every contract address comes from `network.addresses` (`web/src/lib/config/networks.ts`); no address literals elsewhere.

**Units, copy, and display**

- All amounts, prices, and ratios are `bigint` in 1e18 fixed point (`WAD`). No `number` maths on token values.
- Copy is in English.
  - It never says "guaranteed", "risk-free", or "earn X%".
  - Pre-transaction values are labelled estimates (spec §9 copy rules).
- Rounding never makes a position look safer than it is. CR, collateral, position values, and borrowing room round down; debt and liquidation price round up.

**Commands and verification**

- Run all `npm` commands from `web/`. Never run `npm run build` while `npm run dev` is running (they share `.next`).
- Before claiming a task done, run its test command and read the output.

## Review Focus

- **A wallet with 0 BTC when the gas price reads 0 or fails to load must show `needs-gas`, never `ready`.** Pinned by the `readiness` tests "zero balance always needs gas" (Task 5).
- **A background refetch that fails after the dashboard has loaded must keep the last numbers on screen, not swap them for the error card.** Pinned by the `dashboardView` test "keeps data on screen" (Task 7).
- **A wallet sitting on another chain must still read the selected network.** Every snapshot call carries `chainId: network.chainId`. Pinned by the `snapshotContracts` test (Task 2).
- **A debt of 2,062.4165 MUSD must read "2,062.42" and a liquidation price round up, while a CR of 188.595% reads "188.5%".** Pinned by the `formatToken` / `formatPercent` tests (Task 1).
- **No division by zero, whatever the state.** Covers a Trove with zero debt or zero collateral, and a pool with `totalSupply` 0. The page must render "—" or 0, never throw. Pinned by the `health` tests (Task 3) and the `exposure` tests (Task 4).

---

### Task 1: Numeric helpers and number formatting

**Files:**
- Create: `web/src/lib/math.ts`, `web/src/lib/math.test.ts`
- Modify: `web/src/lib/format.ts`, `web/src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `WAD: bigint` (1e18);
  - `isqrt(n: bigint): bigint` (floor square root; throws `RangeError` for negatives);
  - `ceilDiv(a: bigint, b: bigint): bigint`;
  - `formatToken(value: bigint, decimals = 18, fractionDigits = 6, rounding: "down" | "up" = "down"): string`;
  - `formatPercent(ratio: bigint, fractionDigits = 1): string`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/math.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ceilDiv, isqrt, WAD } from "./math";

describe("isqrt", () => {
  it.each([
    [0n, 0n],
    [1n, 1n],
    [2n, 1n],
    [3n, 1n],
    [4n, 2n],
    [15n, 3n],
    [16n, 4n],
    [WAD * WAD, WAD],
    [(WAD + 1n) ** 2n - 1n, WAD],
    // √0.9 at 1e18 precision, the factor for a 10% drawdown.
    [900_000_000_000_000_000_000_000_000_000_000_000n, 948_683_298_050_513_799n],
  ])("isqrt(%s) = %s", (n, expected) => {
    expect(isqrt(n)).toBe(expected);
  });

  it("rejects negative input", () => {
    expect(() => isqrt(-1n)).toThrow(RangeError);
  });
});

describe("ceilDiv", () => {
  it.each([
    [7n, 2n, 4n],
    [6n, 2n, 3n],
    [0n, 5n, 0n],
  ])("ceilDiv(%s, %s) = %s", (a, b, expected) => {
    expect(ceilDiv(a, b)).toBe(expected);
  });
});
```

Append to `web/src/lib/format.test.ts`. Change its import line to `import { formatPercent, formatToken, shortAddress } from "./format";`, then add:

```ts
describe("formatToken rounding", () => {
  const debt = 2_062_416_504_131_786_872_189n;

  it("rounds down by default and up on request", () => {
    expect(formatToken(debt, 18, 2)).toBe("2,062.41");
    expect(formatToken(debt, 18, 2, "up")).toBe("2,062.42");
  });

  it("leaves exact values alone when rounding up", () => {
    expect(formatToken(5n * ONE, 18, 2, "up")).toBe("5");
  });

  it("rounds a dust amount up to the smallest shown unit", () => {
    expect(formatToken(1n, 18, 6, "up")).toBe("0.000001");
  });

  it("formats whole numbers, with a floor for non-zero dust", () => {
    expect(formatToken(50_414_625_656_554_790_209_065n, 18, 0)).toBe("50,414");
    expect(formatToken(50_414_625_656_554_790_209_065n, 18, 0, "up")).toBe("50,415");
    expect(formatToken(1n, 18, 0)).toBe("<1");
  });
});

describe("formatPercent", () => {
  it.each([
    [1_885_952_166_891_434_196n, 1, "188.5%"],
    [1_508_761_733_513_147_357n, 1, "150.8%"],
    [1_500_000_000_000_000_000n, 1, "150%"],
    [1_100_000_000_000_000_000n, 0, "110%"],
    [1_600_000_000_000_000_000n, 0, "160%"],
  ])("formats %s with %s digits as %s, truncated", (ratio, digits, expected) => {
    expect(formatPercent(ratio, digits)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/math.test.ts src/lib/format.test.ts`
Expected: FAIL. `math.test.ts` cannot resolve `./math`, and `format.test.ts` reports `formatPercent` is not a function (the rounding cases fail too).

- [ ] **Step 3: Implement**

Create `web/src/lib/math.ts`:

```ts
/** 1e18: the fixed-point unit of every token amount, price, and ratio in the app. */
export const WAD = 10n ** 18n;

/** Floor of the square root of a non-negative bigint (Newton's method). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("isqrt of a negative number");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** a / b rounded up, for non-negative a and positive b. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}
```

Replace `formatToken` in `web/src/lib/format.ts` and add `formatPercent` (keep `shortAddress` as is):

```ts
import { formatUnits } from "viem";

/**
 * A token amount for display: truncated to `fractionDigits` by default (so a balance is never
 * overstated), or rounded up when understating would flatter the user (debt, liquidation price);
 * trailing zeros dropped, thousands separated. A non-zero amount that would truncate to zero shows
 * as "<0.000001" (or "<1" with no fraction digits), so a small gas balance never reads as empty.
 */
export function formatToken(
  value: bigint,
  decimals = 18,
  fractionDigits = 6,
  rounding: "down" | "up" = "down",
): string {
  const shown = rounding === "up" ? roundUp(value, decimals, fractionDigits) : value;
  const [whole, fraction = ""] = formatUnits(shown, decimals).split(".");
  const kept = fraction.slice(0, fractionDigits).replace(/0+$/, "");
  if (shown > 0n && whole === "0" && kept === "") {
    return fractionDigits === 0 ? "<1" : `<0.${"0".repeat(fractionDigits - 1)}1`;
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return kept ? `${grouped}.${kept}` : grouped;
}

function roundUp(value: bigint, decimals: number, fractionDigits: number): bigint {
  if (fractionDigits >= decimals) return value;
  const step = 10n ** BigInt(decimals - fractionDigits);
  return ((value + step - 1n) / step) * step;
}

/** A 1e18 ratio as a percentage, truncated: 1.509e18 → "150.9%". */
export function formatPercent(ratio: bigint, fractionDigits = 1): string {
  return `${formatToken(ratio * 100n, 18, fractionDigits)}%`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/math.test.ts src/lib/format.test.ts`
Expected: PASS, including the existing `formatToken` and `shortAddress` cases.

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/math.ts web/src/lib/math.test.ts web/src/lib/format.ts web/src/lib/format.test.ts
git commit -m "feat(web): add bigint square root and rounding-aware number formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: MUSD and pool ABIs, and the dashboard snapshot

**Files:**
- Create: `web/src/lib/abi/musd.ts`, `web/src/lib/abi/pool.ts`
- Create: `web/src/lib/dashboard/snapshot.ts`, `web/src/lib/dashboard/snapshot.test.ts`
- Create: `web/src/lib/dashboard/test-fixtures.ts` (test data only; never imported by app code)

**Interfaces:**
- Consumes: `NetworkConfig` and `networks` from `@/lib/config/networks`.
- Produces:
  - Types `Trove`, `LpPosition`, `SpPosition`, `Protocol`, `DashboardSnapshot`, `SnapshotResults`, exactly as in Step 3.
  - `snapshotContracts(network: NetworkConfig, account: Address)`: a 12-call `as const` list.
  - `parseSnapshot(network: NetworkConfig, results: SnapshotResults): DashboardSnapshot`.
  - Fixtures: `ONE`, `FIXTURE_PRICE`, `MCR`, `BORROWING_RATE`, `deployerTrove`, `atRiskTrove`, `lpShare`, `spPosition`, `snapshotWith(overrides)`.

- [ ] **Step 1: Write the ABIs and fixtures**

Create `web/src/lib/abi/musd.ts`:

```ts
import { parseAbi } from "viem";

// MUSD protocol reads (mezo-org/musd `solidity/contracts`), checked against both networks on 5 Oct 2026.

export const troveManagerAbi = parseAbi([
  "function MCR() view returns (uint256)",
  "function getTroveStatus(address borrower) view returns (uint8)",
  "function getEntireDebtAndColl(address borrower) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getTroveMaxBorrowingCapacity(address borrower) view returns (uint256)",
]);

export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);

export const borrowerOperationsAbi = parseAbi(["function borrowingRate() view returns (uint256)"]);

export const stabilityPoolAbi = parseAbi([
  "function getCompoundedMUSDDeposit(address depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address depositor) view returns (uint256)",
]);
```

Create `web/src/lib/abi/pool.ts`:

```ts
import { parseAbi } from "viem";

/** Tigris Pool reads: the pool contract is also the LP token. */
export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);
```

Create `web/src/lib/dashboard/test-fixtures.ts`:

```ts
import type { DashboardSnapshot, LpPosition, SpPosition, Trove } from "./snapshot";

// Test data only. The Trove is the deployer's real testnet Trove, read with `cast` on 5 Oct 2026.

export const ONE = 10n ** 18n;
/** 86,435.975 MUSD per BTC. */
export const FIXTURE_PRICE = 86_435_975_000_000_000_000_000n;
export const MCR = 1_100_000_000_000_000_000n;
/** 0.1%. */
export const BORROWING_RATE = 1_000_000_000_000_000n;

/** CR ≈ 188.6%; the borrowing capacity, not the 160% floor, limits new borrowing. */
export const deployerTrove: Trove = {
  collateral: 45_000_000_000_000_000n,
  principal: 2_061_860_000_000_000_000_000n,
  interest: 556_504_131_786_872_189n,
  debt: 2_062_416_504_131_786_872_189n,
  maxBorrowingCapacity: 2_304_859_297_909_090_909_090n,
};

/** The same debt on 0.036 BTC: CR ≈ 150.9%, at risk, liquidatable after a 30% drop. */
export const atRiskTrove: Trove = { ...deployerTrove, collateral: 36_000_000_000_000_000n };

/** A 10% share of a pool holding 520 MUSD and 0.006 BTC. */
export const lpShare: LpPosition = {
  balance: 100n * ONE,
  totalSupply: 1_000n * ONE,
  reserveMusd: 520n * ONE,
  reserveBtc: 6_000_000_000_000_000n,
};

export const spPosition: SpPosition = { deposit: 50n * ONE, btcGain: 20_000_000_000_000n };

export function snapshotWith(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    price: FIXTURE_PRICE,
    protocol: { mcr: MCR, borrowingRate: BORROWING_RATE },
    trove: null,
    musd: 0n,
    lp: { balance: 0n, totalSupply: 0n, reserveMusd: 0n, reserveBtc: 0n },
    sp: { deposit: 0n, btcGain: 0n },
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing snapshot tests**

Create `web/src/lib/dashboard/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type SnapshotResults } from "./snapshot";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "./test-fixtures";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";

/** Raw multicall results; the pool reserves are (token0, token1, timestamp). */
function raw(status: number, reserves: readonly [bigint, bigint, bigint]): SnapshotResults {
  return [
    FIXTURE_PRICE,
    MCR,
    BORROWING_RATE,
    status,
    [deployerTrove.collateral, deployerTrove.principal, deployerTrove.interest, 0n, 0n, 0n],
    deployerTrove.maxBorrowingCapacity,
    120n * ONE,
    100n * ONE,
    1_000n * ONE,
    reserves,
    50n * ONE,
    20_000_000_000_000n,
  ];
}

describe("snapshotContracts", () => {
  it("reads only the selected network's contracts, on that network's chain", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = snapshotContracts(network, ACCOUNT);
      expect(calls).toHaveLength(12);
      const allowed: string[] = Object.values(network.addresses);
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(allowed).toContain(call.address);
      }
    }
  });

  it("asks about the connected account in every per-user read", () => {
    const withArgs = snapshotContracts(networks.testnet, ACCOUNT).filter((call) => "args" in call);
    expect(withArgs).toHaveLength(7);
    for (const call of withArgs) expect("args" in call && call.args[0]).toBe(ACCOUNT);
  });
});

describe("parseSnapshot", () => {
  it("parses an active Trove, with debt = principal + interest", () => {
    const snapshot = parseSnapshot(networks.testnet, raw(1, [520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(snapshot).toEqual({
      price: FIXTURE_PRICE,
      protocol: { mcr: MCR, borrowingRate: BORROWING_RATE },
      trove: deployerTrove,
      musd: 120n * ONE,
      lp: { balance: 100n * ONE, totalSupply: 1_000n * ONE, reserveMusd: 520n * ONE, reserveBtc: 6_000_000_000_000_000n },
      sp: { deposit: 50n * ONE, btcGain: 20_000_000_000_000n },
    });
  });

  it.each([0, 2, 3, 4])("treats Trove status %s (none or closed) as no Trove", (status) => {
    expect(parseSnapshot(networks.testnet, raw(status, [1n, 1n, 1n])).trove).toBeNull();
  });

  it("orders mainnet reserves by address: token0 is BTC there", () => {
    const snapshot = parseSnapshot(networks.mainnet, raw(1, [6_000_000_000_000_000n, 520n * ONE, 1n]));
    expect(snapshot.lp.reserveBtc).toBe(6_000_000_000_000_000n);
    expect(snapshot.lp.reserveMusd).toBe(520n * ONE);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/dashboard/snapshot.test.ts`
Expected: FAIL. `./snapshot` cannot be resolved.

- [ ] **Step 4: Implement the snapshot**

Create `web/src/lib/dashboard/snapshot.ts`:

```ts
import { erc20Abi, type Address } from "viem";
import { borrowerOperationsAbi, priceFeedAbi, stabilityPoolAbi, troveManagerAbi } from "@/lib/abi/musd";
import { poolAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";

export type Trove = {
  collateral: bigint; // BTC, 1e18, including pending redistribution
  principal: bigint; // MUSD, including pending
  interest: bigint; // MUSD accrued to now, including pending
  debt: bigint; // principal + interest
  maxBorrowingCapacity: bigint; // MUSD; BorrowerOperations rejects borrows past it
};
export type LpPosition = { balance: bigint; totalSupply: bigint; reserveMusd: bigint; reserveBtc: bigint };
export type SpPosition = { deposit: bigint; btcGain: bigint };
export type Protocol = { mcr: bigint; borrowingRate: bigint };
export type DashboardSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  protocol: Protocol;
  trove: Trove | null; // null unless the Trove is active
  musd: bigint;
  lp: LpPosition;
  sp: SpPosition;
};

/** The multicall results in `snapshotContracts` order (`allowFailure: false`). */
export type SnapshotResults = readonly [
  price: bigint,
  mcr: bigint,
  borrowingRate: bigint,
  troveStatus: number,
  debtAndColl: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
  maxBorrowingCapacity: bigint,
  musd: bigint,
  lpBalance: bigint,
  lpTotalSupply: bigint,
  reserves: readonly [bigint, bigint, bigint],
  spDeposit: bigint,
  spBtcGain: bigint,
];

/** TroveManager `Status.active`; none, closedByOwner, closedByLiquidation, and closedByRedemption mean no open Trove. */
const TROVE_ACTIVE = 1;

/**
 * Every dashboard read, sent as one multicall so all values come from the same block. Each call
 * carries the selected network's chain, so a wallet on another chain still reads this network.
 */
export function snapshotContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "MCR" },
    { chainId, address: a.borrowerOperations, abi: borrowerOperationsAbi, functionName: "borrowingRate" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getCompoundedMUSDDeposit", args: [account] },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getDepositorCollateralGain", args: [account] },
  ] as const;
}

export function parseSnapshot(network: NetworkConfig, results: SnapshotResults): DashboardSnapshot {
  const [price, mcr, borrowingRate, status, debtAndColl, maxBorrowingCapacity, musd, lpBalance, lpTotalSupply, reserves, spDeposit, spBtcGain] =
    results;
  const [collateral, principal, interest] = debtAndColl;
  // Tigris sorts a pair by address: testnet's token0 is MUSD, mainnet's is BTC.
  const musdIsToken0 = BigInt(network.addresses.musd) < BigInt(network.addresses.btc);
  return {
    price,
    protocol: { mcr, borrowingRate },
    trove:
      status === TROVE_ACTIVE
        ? { collateral, principal, interest, debt: principal + interest, maxBorrowingCapacity }
        : null,
    musd,
    lp: {
      balance: lpBalance,
      totalSupply: lpTotalSupply,
      reserveMusd: musdIsToken0 ? reserves[0] : reserves[1],
      reserveBtc: musdIsToken0 ? reserves[1] : reserves[0],
    },
    sp: { deposit: spDeposit, btcGain: spBtcGain },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/dashboard/snapshot.test.ts && npx tsc --noEmit -p .`
Expected: PASS (8 tests); `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/abi/musd.ts web/src/lib/abi/pool.ts web/src/lib/dashboard/snapshot.ts web/src/lib/dashboard/snapshot.test.ts web/src/lib/dashboard/test-fixtures.ts
git commit -m "feat(web): read the dashboard snapshot in one multicall

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Trove health

**Files:**
- Create: `web/src/lib/trove/constants.ts`, `web/src/lib/trove/health.ts`, `web/src/lib/trove/health.test.ts`

**Interfaces:**
- Consumes:
  - `WAD`, `ceilDiv` (Task 1);
  - `Trove`, `Protocol` (Task 2);
  - fixtures `deployerTrove`, `FIXTURE_PRICE`, `MCR`, `BORROWING_RATE`, `ONE` (Task 2).
- Produces:
  - `CR_SAFETY_FLOOR: bigint` (1.6e18), `AT_RISK_DROP_PERCENT = 30`;
  - `type TroveHealth = "healthy" | "at-risk" | "liquidatable"`;
  - `collateralRatio(trove: Trove, price: bigint): bigint | null`;
  - `liquidationPrice(trove: Trove, mcr: bigint): bigint | null`;
  - `troveHealth(cr: bigint | null, mcr: bigint): TroveHealth`;
  - `borrowHeadroom(trove: Trove, price: bigint, protocol: Protocol): bigint`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/trove/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "@/lib/dashboard/test-fixtures";
import { borrowHeadroom, collateralRatio, liquidationPrice, troveHealth } from "./health";

const protocol = { mcr: MCR, borrowingRate: BORROWING_RATE };

describe("collateralRatio", () => {
  it("is collateral × price / debt, rounded down", () => {
    expect(collateralRatio(deployerTrove, FIXTURE_PRICE)).toBe(1_885_952_166_891_434_196n);
  });

  it("is null without debt", () => {
    expect(collateralRatio({ ...deployerTrove, principal: 0n, interest: 0n, debt: 0n }, FIXTURE_PRICE)).toBeNull();
  });
});

describe("liquidationPrice", () => {
  it("is debt × MCR / collateral, rounded up", () => {
    expect(liquidationPrice(deployerTrove, MCR)).toBe(50_414_625_656_554_790_209_065n);
  });

  it("is null without collateral", () => {
    expect(liquidationPrice({ ...deployerTrove, collateral: 0n }, MCR)).toBeNull();
  });
});

describe("troveHealth", () => {
  it.each([
    [null, "healthy"],
    [1_885_952_166_891_434_196n, "healthy"],
    // 110% / 0.7 = 157.142857…%: just above survives a 30% drop, just below does not.
    [1_571_428_571_428_571_429n, "healthy"],
    [1_571_428_571_428_571_428n, "at-risk"],
    [MCR, "at-risk"],
    [MCR - 1n, "liquidatable"],
  ] as const)("CR %s is %s", (cr, expected) => {
    expect(troveHealth(cr, MCR)).toBe(expected);
  });
});

describe("borrowHeadroom", () => {
  it("is limited by the Trove's borrowing capacity, net of the borrowing fee", () => {
    expect(borrowHeadroom(deployerTrove, FIXTURE_PRICE, protocol)).toBe(242_200_593_184_119_916_984n);
  });

  it("is the whole gap to the capacity without a borrowing fee", () => {
    expect(borrowHeadroom(deployerTrove, FIXTURE_PRICE, { mcr: MCR, borrowingRate: 0n })).toBe(242_442_793_777_304_036_901n);
  });

  it("is limited by the 160% floor when the capacity is higher", () => {
    const trove = { ...deployerTrove, maxBorrowingCapacity: 10_000n * ONE };
    expect(borrowHeadroom(trove, FIXTURE_PRICE, protocol)).toBe(368_227_065_677_535_592_218n);
  });

  it("is zero when the debt already reaches the limit", () => {
    expect(borrowHeadroom(deployerTrove, 50_000n * ONE, protocol)).toBe(0n);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/trove/health.test.ts`
Expected: FAIL. `./health` cannot be resolved.

- [ ] **Step 3: Implement**

Create `web/src/lib/trove/constants.ts`:

```ts
/**
 * Provisional CR safety floor (PRODUCT_SPEC §21, set in F2 on 5 Oct 2026): a borrow never leaves the
 * Trove below 160%, so it survives a 30% BTC drop above the 110% MCR. F4 reuses it.
 */
export const CR_SAFETY_FLOOR = 1_600_000_000_000_000_000n;

/** A Trove is "at risk" when a drop of this size would put it below the protocol MCR. */
export const AT_RISK_DROP_PERCENT = 30;
```

Create `web/src/lib/trove/health.ts`:

```ts
import type { Protocol, Trove } from "@/lib/dashboard/snapshot";
import { ceilDiv, WAD } from "@/lib/math";
import { AT_RISK_DROP_PERCENT, CR_SAFETY_FLOOR } from "./constants";

export type TroveHealth = "healthy" | "at-risk" | "liquidatable";

/** Collateral value over debt (1e18 = 100%), rounded down; null when there is no debt. */
export function collateralRatio(trove: Trove, price: bigint): bigint | null {
  if (trove.debt === 0n) return null;
  return (trove.collateral * price) / trove.debt;
}

/** The BTC price at which the Trove reaches the MCR, rounded up; null without collateral. */
export function liquidationPrice(trove: Trove, mcr: bigint): bigint | null {
  if (trove.collateral === 0n) return null;
  return ceilDiv(trove.debt * mcr, trove.collateral);
}

export function troveHealth(cr: bigint | null, mcr: bigint): TroveHealth {
  if (cr === null) return "healthy";
  if (cr < mcr) return "liquidatable";
  if ((cr * BigInt(100 - AT_RISK_DROP_PERCENT)) / 100n < mcr) return "at-risk";
  return "healthy";
}

/**
 * The most MUSD the Trove can still borrow, rounded down. BorrowerOperations caps debt at the Trove's
 * `maxBorrowingCapacity`, and MezoRoute keeps the collateral ratio at or above the safety floor; the
 * borrowing fee is added to the debt, so the gap is divided by (1 + fee).
 */
export function borrowHeadroom(trove: Trove, price: bigint, protocol: Protocol): bigint {
  const byFloor = (trove.collateral * price) / CR_SAFETY_FLOOR;
  const limit = byFloor < trove.maxBorrowingCapacity ? byFloor : trove.maxBorrowingCapacity;
  if (limit <= trove.debt) return 0n;
  return ((limit - trove.debt) * WAD) / (WAD + protocol.borrowingRate);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/trove/health.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/trove/constants.ts web/src/lib/trove/health.ts web/src/lib/trove/health.test.ts
git commit -m "feat(web): add Trove collateral ratio, health, and borrowing headroom

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Exposure module

**Files:**
- Create: `web/src/lib/exposure/exposure.ts`, `web/src/lib/exposure/exposure.test.ts`

**Interfaces:**
- Consumes:
  - `WAD`, `isqrt` (Task 1);
  - `DashboardSnapshot` (Task 2);
  - `collateralRatio` (Task 3);
  - fixtures `snapshotWith`, `deployerTrove`, `atRiskTrove`, `lpShare`, `spPosition` (Task 2).
- Produces:
  - `DRAWDOWNS = [10, 20, 30] as const`, `type Drawdown`;
  - `type Exposure`, `type Scenario` (exactly as in Step 3);
  - `exposure(snapshot: DashboardSnapshot): Exposure`;
  - `drawdownScenarios(snapshot: DashboardSnapshot, current: Exposure): Scenario[]`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/exposure/exposure.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { atRiskTrove, deployerTrove, lpShare, snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { drawdownScenarios, exposure } from "./exposure";

const full = snapshotWith({ trove: deployerTrove, lp: lpShare, sp: spPosition });

describe("exposure", () => {
  it("adds Trove, LP, and Stability Pool BTC, and values the LP and SP positions", () => {
    expect(exposure(full)).toEqual({
      troveBtc: 45_000_000_000_000_000n,
      lpBtc: 600_000_000_000_000n,
      lpMusd: 52_000_000_000_000_000_000n,
      spBtcGain: 20_000_000_000_000n,
      spDeposit: 50_000_000_000_000_000_000n,
      totalBtc: 45_620_000_000_000_000n,
      lpValue: 103_861_585_000_000_000_000n,
      spValue: 51_728_719_500_000_000_000n,
    });
  });

  it("handles no Trove", () => {
    const current = exposure(snapshotWith({ lp: lpShare, sp: spPosition }));
    expect(current.troveBtc).toBe(0n);
    expect(current.totalBtc).toBe(620_000_000_000_000n);
  });

  it("handles no LP, and an empty pool without dividing by zero", () => {
    expect(exposure(snapshotWith({ trove: deployerTrove })).lpValue).toBe(0n);
    const emptyPool = exposure(snapshotWith({ lp: { ...lpShare, totalSupply: 0n } }));
    expect(emptyPool.lpBtc).toBe(0n);
    expect(emptyPool.lpMusd).toBe(0n);
  });

  it("handles no Stability Pool deposit", () => {
    const current = exposure(snapshotWith({ trove: deployerTrove }));
    expect(current.spValue).toBe(0n);
    expect(current.totalBtc).toBe(45_000_000_000_000_000n);
  });
});

describe("drawdownScenarios", () => {
  it("lowers the price, the collateral ratio, and both position values for each drawdown", () => {
    const snapshot = snapshotWith({ trove: atRiskTrove, lp: lpShare, sp: spPosition });
    expect(drawdownScenarios(snapshot, exposure(snapshot))).toEqual([
      {
        dropPercent: 10,
        price: 77_792_377_500_000_000_000_000n,
        collateralRatio: 1_357_885_560_161_832_621n,
        liquidatable: false,
        lpValue: 98_531_750_998_553_773_228n,
        spValue: 51_555_847_550_000_000_000n,
      },
      {
        dropPercent: 20,
        price: 69_148_780_000_000_000_000_000n,
        collateralRatio: 1_207_009_386_810_517_885n,
        liquidatable: false,
        lpValue: 92_896_625_724_348_997_955n,
        spValue: 51_382_975_600_000_000_000n,
      },
      {
        dropPercent: 30,
        price: 60_505_182_500_000_000_000_000n,
        collateralRatio: 1_056_133_213_459_203_149n,
        liquidatable: true,
        lpValue: 86_896_836_461_971_142_821n,
        spValue: 51_210_103_650_000_000_000n,
      },
    ]);
  });

  it("has no collateral ratio without a Trove", () => {
    const snapshot = snapshotWith({ lp: lpShare });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.collateralRatio).toBeNull();
      expect(scenario.liquidatable).toBe(false);
    }
  });

  it("has no collateral ratio for a Trove with zero debt", () => {
    const trove = { ...deployerTrove, principal: 0n, interest: 0n, debt: 0n };
    const snapshot = snapshotWith({ trove });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.collateralRatio).toBeNull();
      expect(scenario.liquidatable).toBe(false);
    }
  });

  it("keeps empty positions at zero", () => {
    const snapshot = snapshotWith({ trove: deployerTrove });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.lpValue).toBe(0n);
      expect(scenario.spValue).toBe(0n);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/exposure/exposure.test.ts`
Expected: FAIL. `./exposure` cannot be resolved.

- [ ] **Step 3: Implement**

Create `web/src/lib/exposure/exposure.ts`:

```ts
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { isqrt, WAD } from "@/lib/math";
import { collateralRatio } from "@/lib/trove/health";

/** BTC price drops shown on the dashboard and previews (PRODUCT_SPEC §12, FR-15). */
export const DRAWDOWNS = [10, 20, 30] as const;
export type Drawdown = (typeof DRAWDOWNS)[number];

export type Exposure = {
  troveBtc: bigint;
  lpBtc: bigint; // the wallet's LP share of the pool's BTC
  lpMusd: bigint; // the wallet's LP share of the pool's MUSD
  spBtcGain: bigint;
  spDeposit: bigint;
  totalBtc: bigint; // troveBtc + lpBtc + spBtcGain
  lpValue: bigint; // MUSD: lpMusd + lpBtc × price
  spValue: bigint; // MUSD: spDeposit + spBtcGain × price
};

export type Scenario = {
  dropPercent: Drawdown;
  price: bigint;
  collateralRatio: bigint | null; // null without a Trove or without debt
  liquidatable: boolean; // collateralRatio below the protocol MCR
  lpValue: bigint; // constant-product approximation, fees ignored
  spValue: bigint; // new liquidations caused by the drop are not modelled
};

/** BTC held across the Trove, the LP share, and Stability Pool gains, valued at the oracle price. Rounds down. */
export function exposure(snapshot: DashboardSnapshot): Exposure {
  const { price, trove, lp, sp } = snapshot;
  const share = (reserve: bigint) => (lp.totalSupply === 0n ? 0n : (lp.balance * reserve) / lp.totalSupply);
  const troveBtc = trove?.collateral ?? 0n;
  const lpBtc = share(lp.reserveBtc);
  const lpMusd = share(lp.reserveMusd);
  return {
    troveBtc,
    lpBtc,
    lpMusd,
    spBtcGain: sp.btcGain,
    spDeposit: sp.deposit,
    totalBtc: troveBtc + lpBtc + sp.btcGain,
    lpValue: lpMusd + (lpBtc * price) / WAD,
    spValue: sp.deposit + (sp.btcGain * price) / WAD,
  };
}

/** The dashboard's "what if BTC drops" table: one row per drawdown, all values rounded down. */
export function drawdownScenarios(snapshot: DashboardSnapshot, current: Exposure): Scenario[] {
  return DRAWDOWNS.map((dropPercent) => {
    const keep = BigInt(100 - dropPercent);
    const price = (snapshot.price * keep) / 100n;
    const cr = snapshot.trove ? collateralRatio(snapshot.trove, price) : null;
    // A constant-product LP's value scales with √(price ratio).
    const lpFactor = isqrt((keep * WAD * WAD) / 100n);
    return {
      dropPercent,
      price,
      collateralRatio: cr,
      liquidatable: cr !== null && cr < snapshot.protocol.mcr,
      lpValue: (current.lpValue * lpFactor) / WAD,
      spValue: current.spDeposit + (current.spBtcGain * price) / WAD,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/exposure/exposure.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/exposure/exposure.ts web/src/lib/exposure/exposure.test.ts
git commit -m "feat(web): add the BTC exposure module with drawdown scenarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Readiness, its copy, and the Trove warning

**Files:**
- Create: `web/src/lib/dashboard/readiness.ts`, `web/src/lib/dashboard/readiness.test.ts`

**Interfaces:**
- Consumes:
  - `formatPercent`, `formatToken` (Task 1);
  - `DashboardSnapshot` (Task 2);
  - `borrowHeadroom`, `collateralRatio`, `troveHealth`, `TroveHealth`, `CR_SAFETY_FLOOR`, `AT_RISK_DROP_PERCENT` (Task 3);
  - `WalletKind` (`@/lib/wallet/capabilities`);
  - `NetworkConfig`, `networks`.
- Produces:
  - `GAS_BUDGET = 3_000_000n`, `MIN_USABLE_MUSD = 10n ** 18n`;
  - `type ReadinessState`;
  - `type Readiness = { state: ReadinessState; borrowable: bigint; health: TroveHealth | null }`;
  - `readiness(input: { snapshot: DashboardSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; walletKind: WalletKind }): Readiness`;
  - `type ReadinessCopy = { tone: "positive" | "attention" | "neutral"; tag: string; headline: string; detail?: string; action?: { label: string; href: string } }`;
  - `readinessCopy(readiness: Readiness, context: { musd: bigint; walletKind: WalletKind; network: NetworkConfig }): ReadinessCopy`;
  - `type TroveWarning = { tone: "warning" | "danger"; message: string }`;
  - `troveWarning(health: TroveHealth | null, mcr: bigint): TroveWarning | null`.

The plan refines the spec here in one respect: `readinessCopy` takes `{ musd, walletKind, network }` instead of `(readiness, snapshot, network)`. The `ready` state's "You can also borrow" line depends on the wallet kind, which the snapshot does not hold.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/dashboard/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { readiness, readinessCopy, troveWarning, type Readiness } from "./readiness";
import { atRiskTrove, deployerTrove, MCR, ONE, snapshotWith } from "./test-fixtures";

const MAINNET_GAS_PRICE = 1_462_500n;
const ROOM = 242_200_593_184_119_916_984n; // borrowHeadroom of the deployer Trove

function check(overrides: Partial<Parameters<typeof readiness>[0]> = {}) {
  return readiness({
    snapshot: snapshotWith(),
    gasBalance: ONE,
    gasPrice: 146n,
    walletKind: "eoa",
    ...overrides,
  });
}

describe("readiness", () => {
  it("needs gas before anything else", () => {
    const result = check({ snapshot: snapshotWith({ musd: 120n * ONE, trove: deployerTrove }), gasBalance: 0n });
    expect(result.state).toBe("needs-gas");
  });

  it("needs gas below the budget at the current gas price", () => {
    const budget = MAINNET_GAS_PRICE * 3_000_000n;
    expect(check({ gasBalance: budget - 1n, gasPrice: MAINNET_GAS_PRICE }).state).toBe("needs-gas");
    expect(check({ gasBalance: budget, gasPrice: MAINNET_GAS_PRICE }).state).not.toBe("needs-gas");
  });

  it("zero balance always needs gas, whatever the gas price reads", () => {
    expect(check({ gasBalance: 0n, gasPrice: undefined }).state).toBe("needs-gas");
    expect(check({ gasBalance: 0n, gasPrice: 0n }).state).toBe("needs-gas");
  });

  it("accepts any non-zero balance when the gas price is unknown", () => {
    expect(check({ gasBalance: 1n, gasPrice: undefined }).state).not.toBe("needs-gas");
  });

  it("is ready with at least 1 MUSD, ahead of borrowing", () => {
    const result = check({ snapshot: snapshotWith({ musd: 120n * ONE, trove: deployerTrove }) });
    expect(result).toEqual({ state: "ready", borrowable: ROOM, health: "healthy" });
  });

  it("does not count dust MUSD as ready", () => {
    expect(check({ snapshot: snapshotWith({ musd: ONE - 1n }) }).state).toBe("no-trove");
  });

  it("can borrow with a standard wallet and room on the Trove", () => {
    expect(check({ snapshot: snapshotWith({ trove: deployerTrove }) })).toEqual({
      state: "can-borrow",
      borrowable: ROOM,
      health: "healthy",
    });
  });

  it.each(["smart-account", "unknown"] as const)("sends a %s wallet to the Mezo app to borrow", (walletKind) => {
    expect(check({ snapshot: snapshotWith({ trove: deployerTrove }), walletKind }).state).toBe("borrow-in-mezo");
  });

  it("has no room on a Trove below the floor, and reports its health", () => {
    expect(check({ snapshot: snapshotWith({ trove: atRiskTrove }) })).toEqual({
      state: "no-room",
      borrowable: 0n,
      health: "at-risk",
    });
  });

  it("has nothing to start with: no MUSD and no Trove", () => {
    expect(check()).toEqual({ state: "no-trove", borrowable: 0n, health: null });
  });
});

describe("readinessCopy", () => {
  const testnet = networks.testnet;
  const mainnet = networks.mainnet;
  const state = (s: Readiness["state"], borrowable = 0n): Readiness => ({ state: s, borrowable, health: null });
  const context = { musd: 120n * ONE, walletKind: "eoa" as const, network: testnet };

  it("sends testnet users to the faucet and mainnet users to the Mezo app for gas", () => {
    expect(readinessCopy(state("needs-gas"), context)).toEqual({
      tone: "attention",
      tag: "Needs gas",
      headline: "You need BTC on Mezo to pay for transactions.",
      action: { label: "Get test BTC", href: "https://faucet.test.mezo.org" },
    });
    expect(readinessCopy(state("needs-gas"), { ...context, network: mainnet }).action).toEqual({
      label: "Open Mezo app",
      href: "https://mezo.org",
    });
  });

  it("offers borrowing next to ready MUSD only to a standard wallet with room", () => {
    expect(readinessCopy(state("ready", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Ready",
      headline: "You have 120 MUSD ready to deploy.",
      detail: "You can also borrow up to 242.2 MUSD.",
    });
    expect(readinessCopy(state("ready", ROOM), { ...context, walletKind: "smart-account" }).detail).toBeUndefined();
    expect(readinessCopy(state("ready", 0n), context).detail).toBeUndefined();
  });

  it("words each borrowing and empty state", () => {
    expect(readinessCopy(state("can-borrow", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Can borrow",
      headline: "Borrow up to 242.2 MUSD against your Trove and deploy it in one transaction.",
    });
    expect(readinessCopy(state("borrow-in-mezo", ROOM), context)).toEqual({
      tone: "positive",
      tag: "Can borrow",
      headline: "Your Trove can borrow up to 242.2 MUSD.",
      detail: "Borrow it in the Mezo app first; Borrow & Deploy needs a standard wallet signature.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
    expect(readinessCopy(state("no-room"), context)).toEqual({
      tone: "neutral",
      tag: "No MUSD",
      headline: "Your Trove has no room to borrow above a 160% collateral ratio.",
      detail: "Add collateral in the Mezo app.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
    expect(readinessCopy(state("no-trove"), context)).toEqual({
      tone: "neutral",
      tag: "No MUSD",
      headline: "You need MUSD to start.",
      detail: "Open a Trove in the Mezo app to borrow MUSD against BTC.",
      action: { label: "Open Mezo app", href: "https://testnet.mezo.org" },
    });
  });
});

describe("troveWarning", () => {
  it("is silent for a healthy Trove or none", () => {
    expect(troveWarning(null, MCR)).toBeNull();
    expect(troveWarning("healthy", MCR)).toBeNull();
  });

  it("warns about an at-risk Trove with the spec's copy", () => {
    expect(troveWarning("at-risk", MCR)).toEqual({
      tone: "warning",
      message:
        "Your Trove is at risk: a 30% BTC drop would make it liquidatable. Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.",
    });
  });

  it("names the MCR read from the chain when the Trove can be liquidated", () => {
    expect(troveWarning("liquidatable", MCR)).toEqual({
      tone: "danger",
      message: "Your Trove is below the 110% minimum and can be liquidated.",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/dashboard/readiness.test.ts`
Expected: FAIL. `./readiness` cannot be resolved.

- [ ] **Step 3: Implement**

Create `web/src/lib/dashboard/readiness.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { formatPercent, formatToken } from "@/lib/format";
import { AT_RISK_DROP_PERCENT, CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { borrowHeadroom, collateralRatio, troveHealth, type TroveHealth } from "@/lib/trove/health";
import type { WalletKind } from "@/lib/wallet/capabilities";
import type { DashboardSnapshot } from "./snapshot";

/** Gas units the heaviest flow needs (approve + borrowAndEnter), with margin. */
export const GAS_BUDGET = 3_000_000n;
/** Below 1 MUSD the wallet has nothing worth routing. */
export const MIN_USABLE_MUSD = 10n ** 18n;

export type ReadinessState = "needs-gas" | "ready" | "can-borrow" | "borrow-in-mezo" | "no-room" | "no-trove";
export type Readiness = { state: ReadinessState; borrowable: bigint; health: TroveHealth | null };

/** The dashboard's one readiness state (PRODUCT_SPEC §7 Flow A); the first matching state wins. */
export function readiness(input: {
  snapshot: DashboardSnapshot;
  gasBalance: bigint;
  gasPrice: bigint | undefined;
  walletKind: WalletKind;
}): Readiness {
  const { snapshot, gasBalance, gasPrice, walletKind } = input;
  const { trove, price, protocol, musd } = snapshot;
  const borrowable = trove ? borrowHeadroom(trove, price, protocol) : 0n;
  const health = trove ? troveHealth(collateralRatio(trove, price), protocol.mcr) : null;
  // An empty wallet can never pay; an unknown gas price trusts any non-zero balance.
  const needsGas = gasBalance === 0n || (gasPrice !== undefined && gasBalance < gasPrice * GAS_BUDGET);

  let state: ReadinessState;
  if (needsGas) state = "needs-gas";
  else if (musd >= MIN_USABLE_MUSD) state = "ready";
  else if (borrowable >= MIN_USABLE_MUSD) state = walletKind === "eoa" ? "can-borrow" : "borrow-in-mezo";
  else if (trove) state = "no-room";
  else state = "no-trove";
  return { state, borrowable, health };
}

export type ReadinessCopy = {
  tone: "positive" | "attention" | "neutral";
  tag: string;
  headline: string;
  detail?: string;
  action?: { label: string; href: string };
};

const musdAmount = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

export function readinessCopy(
  readiness: Readiness,
  context: { musd: bigint; walletKind: WalletKind; network: NetworkConfig },
): ReadinessCopy {
  const { musd, walletKind, network } = context;
  const mezoApp = { label: "Open Mezo app", href: network.mezoAppUrl };
  const room = musdAmount(readiness.borrowable);
  switch (readiness.state) {
    case "needs-gas":
      return {
        tone: "attention",
        tag: "Needs gas",
        headline: "You need BTC on Mezo to pay for transactions.",
        action: network.faucetUrl ? { label: "Get test BTC", href: network.faucetUrl } : mezoApp,
      };
    case "ready":
      return {
        tone: "positive",
        tag: "Ready",
        headline: `You have ${musdAmount(musd)} ready to deploy.`,
        ...(walletKind === "eoa" && readiness.borrowable >= MIN_USABLE_MUSD
          ? { detail: `You can also borrow up to ${room}.` }
          : {}),
      };
    case "can-borrow":
      return {
        tone: "positive",
        tag: "Can borrow",
        headline: `Borrow up to ${room} against your Trove and deploy it in one transaction.`,
      };
    case "borrow-in-mezo":
      return {
        tone: "positive",
        tag: "Can borrow",
        headline: `Your Trove can borrow up to ${room}.`,
        detail: "Borrow it in the Mezo app first; Borrow & Deploy needs a standard wallet signature.",
        action: mezoApp,
      };
    case "no-room":
      return {
        tone: "neutral",
        tag: "No MUSD",
        headline: `Your Trove has no room to borrow above a ${formatPercent(CR_SAFETY_FLOOR, 0)} collateral ratio.`,
        detail: "Add collateral in the Mezo app.",
        action: mezoApp,
      };
    case "no-trove":
      return {
        tone: "neutral",
        tag: "No MUSD",
        headline: "You need MUSD to start.",
        detail: "Open a Trove in the Mezo app to borrow MUSD against BTC.",
        action: mezoApp,
      };
  }
}

export type TroveWarning = { tone: "warning" | "danger"; message: string };

/** The persistent banner above the dashboard; it never blocks using wallet MUSD (Flow A). */
export function troveWarning(health: TroveHealth | null, mcr: bigint): TroveWarning | null {
  if (health === "liquidatable") {
    return { tone: "danger", message: `Your Trove is below the ${formatPercent(mcr, 0)} minimum and can be liquidated.` };
  }
  if (health === "at-risk") {
    return {
      tone: "warning",
      message: `Your Trove is at risk: a ${AT_RISK_DROP_PERCENT}% BTC drop would make it liquidatable. Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.`,
    };
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/dashboard/readiness.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/dashboard/readiness.ts web/src/lib/dashboard/readiness.test.ts
git commit -m "feat(web): derive the readiness state, its copy, and the Trove warning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Error decoder: stale price feed, and RPC outages during reads

**Files:**
- Modify: `web/src/lib/errors/types.ts` (add `"price-unavailable"` to `ErrorKind`)
- Modify: `web/src/lib/errors/outcomes.ts` (add `PRICE_UNAVAILABLE`)
- Modify: `web/src/lib/errors/revert-strings.ts` (add the stale-oracle row)
- Modify: `web/src/lib/errors/decode.ts` (RPC-down before generic reverts when there is no hash)
- Test: `web/src/lib/errors/decode.test.ts`

**Interfaces:**
- Consumes: `priceFeedAbi` (Task 2).
- Produces:
  - `ErrorKind` gains `"price-unavailable"`;
  - `PRICE_UNAVAILABLE: Outcome`;
  - `decodeError` behaviour for the two cases below. Its signature is unchanged.

- [ ] **Step 1: Write the failing tests**

In `web/src/lib/errors/decode.test.ts`, add `import { priceFeedAbi } from "@/lib/abi/musd";` next to the other `@/lib/abi` imports. Then append these tests inside the existing `describe("decodeError: reverts without data, RPC failures, and the rest", …)` block, after the `it.each` RPC case:

```ts
  it("maps a stale BTC price feed to a retry, from revert data or from text", () => {
    const stale = { kind: "price-unavailable", message: "The BTC price feed is temporarily unavailable.", recovery: ["retry"] };
    const data = encode(ozAbi, "Error", ["PriceFeed: Oracle is stale."]);
    expect(decodeError(contractRevert(data), testnet)).toMatchObject(stale);
    expect(decodeError(new Error("execution reverted: PriceFeed: Oracle is stale."), testnet)).toMatchObject(stale);
  });

  it("reports an RPC outage during a read as unavailable, not as a revert", () => {
    // wagmi's readContracts falls back to single readContract calls when the multicall request fails.
    const error = new ContractFunctionExecutionError(
      new CallExecutionError(new HttpRequestError({ url: "https://rpc.test.mezo.org" }), {}),
      { abi: priceFeedAbi, functionName: "fetchPrice", args: [] },
    );
    expect(decodeError(error, testnet)).toEqual({
      kind: "rpc-unavailable",
      message: "Mezo Testnet is temporarily unavailable.",
      recovery: ["retry"],
    });
  });

  it("still reports a mined transaction as reverted when its replay hit an RPC error", () => {
    const replay = new CallExecutionError(new HttpRequestError({ url: "https://rpc.test.mezo.org" }), {});
    expect(decodeError(new TransactionRevertedError(HASH, { cause: replay }), testnet)).toMatchObject({
      kind: "reverted",
      hash: HASH,
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/errors/decode.test.ts`
Expected: FAIL in 2 tests.
- The stale-feed test gets `kind: "reverted"` (no matching revert string).
- The read-outage test gets `kind: "reverted"` (CallExecutionError matches the generic revert names first).
- The mined-transaction test passes already. It pins behaviour that the fix must keep.

- [ ] **Step 3: Implement**

In `web/src/lib/errors/types.ts`, add `| "price-unavailable"` to `ErrorKind`, directly before `| "reverted"`.

In `web/src/lib/errors/outcomes.ts`, add after `POOL`:

```ts
export const PRICE_UNAVAILABLE: Outcome = {
  kind: "price-unavailable",
  message: "The BTC price feed is temporarily unavailable.",
  recovery: ["retry"],
};
```

In `web/src/lib/errors/revert-strings.ts`, change the import to `import { ALLOWANCE, INSUFFICIENT_BALANCE, PRICE_UNAVAILABLE } from "./outcomes";` and add the row at the end of `REVERT_STRINGS`:

```ts
  // MUSD PriceFeed.fetchPrice(): every Trove read and borrow needs a fresh price.
  { match: /PriceFeed: Oracle is stale/i, outcome: PRICE_UNAVAILABLE },
```

In `web/src/lib/errors/decode.ts`, replace the tail of `decodeError`, from `const fromText = revertStringOutcome(text);` to the final `return`, with:

```ts
  const fromText = revertStringOutcome(text);
  if (fromText) return result(fromText);
  const rpcDown = names.some((name) => RPC_DOWN_NAMES.includes(name)) || RPC_DOWN_TEXT.test(text);
  // Without a hash nothing was mined: a read or simulation that never reached a node is an outage,
  // even though viem wraps it in CallExecutionError.
  if (rpcDown && !hash) return result(rpcUnavailable(network));
  if (names.some((name) => REVERT_NAMES.includes(name)) || REVERT_TEXT.test(text)) {
    // With a hash, the hash is the useful detail; the message would only repeat it.
    return result(REVERTED, hash ? undefined : messages[0]);
  }
  if (rpcDown) return result(rpcUnavailable(network));
  return result(UNKNOWN, messages[0] ?? String(error));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/errors && npx tsc --noEmit -p .`
Expected: PASS for every decoder test, including all F1 cases; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/errors/types.ts web/src/lib/errors/outcomes.ts web/src/lib/errors/revert-strings.ts web/src/lib/errors/decode.ts web/src/lib/errors/decode.test.ts
git commit -m "fix(web): decode a stale price feed and RPC outages during reads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Snapshot hook, dashboard frame, readiness card, and Trove warning

**Files:**
- Create: `web/src/lib/dashboard/view.ts`, `web/src/lib/dashboard/view.test.ts`
- Create: `web/src/lib/dashboard/useDashboardSnapshot.ts`
- Create: `web/src/components/ExternalButton.tsx`
- Create: `web/src/components/dashboard/Dashboard.tsx`, `web/src/components/dashboard/ReadinessCard.tsx`, `web/src/components/dashboard/TroveWarning.tsx`
- Modify: `web/src/components/home/Home.tsx`
- Delete: `web/src/components/home/WalletCard.tsx`

**Interfaces:**
- Consumes:
  - `snapshotContracts`, `parseSnapshot`, `DashboardSnapshot` (Task 2);
  - `readiness`, `readinessCopy`, `troveWarning`, `Readiness`, `TroveWarning` (Task 5);
  - `decodeError`;
  - `useNetwork`;
  - `useWalletKind`, `walletKindLabel`, `walletKindNote`, `isOrangeKitConnector`;
  - `writeBlocker`, `writeBlockerMessage`;
  - `formatToken`, `shortAddress`;
  - `WrongNetworkAlert` (F1).
- Produces:
  - `dashboardView(input: { hasData: boolean; walletKindKnown: boolean; hasError: boolean }): "content" | "error" | "loading"`;
  - `type DashboardData = { snapshot: DashboardSnapshot; gasBalance: bigint; gasPrice: bigint | undefined }`;
  - `useDashboardSnapshot(account: Address): { data: DashboardData | undefined; error: Error | null; refresh: () => void }`;
  - `ExternalButton({ href, children })`;
  - `Dashboard({ account })`. Its `DashboardBody({ data, walletKind, account })` is where Task 8 adds `TroveCard` and `ExposurePanel`.

- [ ] **Step 1: Write the failing view test**

Create `web/src/lib/dashboard/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dashboardView } from "./view";

describe("dashboardView", () => {
  it("shows the dashboard once the data and the wallet kind are known", () => {
    expect(dashboardView({ hasData: true, walletKindKnown: true, hasError: false })).toBe("content");
  });

  it("keeps data on screen when a background refetch fails", () => {
    expect(dashboardView({ hasData: true, walletKindKnown: true, hasError: true })).toBe("content");
  });

  it("shows the error card only when there is nothing to show", () => {
    expect(dashboardView({ hasData: false, walletKindKnown: true, hasError: true })).toBe("error");
    expect(dashboardView({ hasData: false, walletKindKnown: false, hasError: true })).toBe("error");
  });

  it("waits for the first snapshot and for the wallet kind", () => {
    expect(dashboardView({ hasData: false, walletKindKnown: true, hasError: false })).toBe("loading");
    expect(dashboardView({ hasData: true, walletKindKnown: false, hasError: false })).toBe("loading");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/dashboard/view.test.ts`
Expected: FAIL. `./view` cannot be resolved.

- [ ] **Step 3: Implement the view rule**

Create `web/src/lib/dashboard/view.ts`:

```ts
export type DashboardView = "content" | "error" | "loading";

/**
 * What the dashboard renders. Data on screen wins: a failed background refetch keeps the last
 * snapshot instead of an error card. Readiness waits for the wallet kind, so a standard wallet never
 * flashes the smart-account state first.
 */
export function dashboardView(input: { hasData: boolean; walletKindKnown: boolean; hasError: boolean }): DashboardView {
  if (input.hasData && input.walletKindKnown) return "content";
  if (!input.hasData && input.hasError) return "error";
  return "loading";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/dashboard/view.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the hook**

Create `web/src/lib/dashboard/useDashboardSnapshot.ts`:

```ts
"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot } from "./snapshot";

const REFRESH_MS = 30_000;

export type DashboardData = { snapshot: DashboardSnapshot; gasBalance: bigint; gasPrice: bigint | undefined };

/**
 * The dashboard's reads: one multicall snapshot plus the BTC gas balance and gas price, all on the
 * selected network whatever chain the wallet is on, refreshed every 30 s. A gas-price failure only
 * loosens the gas check; a snapshot or balance failure is an error. F3/F5 refresh after each
 * confirmed transaction (FR-02).
 */
export function useDashboardSnapshot(account: Address): {
  data: DashboardData | undefined;
  error: Error | null;
  refresh: () => void;
} {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: snapshotContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: REFRESH_MS } });

  const data =
    reads.data && gas.data
      ? { snapshot: parseSnapshot(network, reads.data), gasBalance: gas.data.value, gasPrice: gasPrice.data }
      : undefined;
  return {
    data,
    error: reads.error ?? gas.error ?? null,
    refresh: () => {
      void reads.refetch();
      void gas.refetch();
      void gasPrice.refetch();
    },
  };
}
```

- [ ] **Step 6: Write the components**

Create `web/src/components/ExternalButton.tsx`:

```tsx
import type { ReactNode } from "react";

/** A secondary pill button that opens another site (faucet, Mezo app) in a new tab. */
export function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-block rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-accent hover:bg-accent-soft"
    >
      {children}
    </a>
  );
}
```

Create `web/src/components/dashboard/TroveWarning.tsx`:

```tsx
import type { TroveWarning as Warning } from "@/lib/dashboard/readiness";

/** Persistent while the Trove is unhealthy; it never blocks using wallet MUSD (Flow A). */
export function TroveWarning({ warning }: { warning: Warning }) {
  const tone = warning.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-bg text-warning-ink";
  return (
    <div role="alert" className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${tone}`}>
      <span className="min-w-0 flex-1">{warning.message}</span>
      <a
        href="#exposure"
        className="shrink-0 rounded-full border border-current bg-white px-3 py-1.5 text-xs font-semibold"
      >
        Review exposure
      </a>
    </div>
  );
}
```

Create `web/src/components/dashboard/ReadinessCard.tsx`:

```tsx
"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ExternalButton } from "@/components/ExternalButton";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlocker, writeBlockerMessage } from "@/lib/config/write-gate";
import { readinessCopy, type Readiness, type ReadinessCopy } from "@/lib/dashboard/readiness";
import type { DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { formatToken, shortAddress } from "@/lib/format";
import { isOrangeKitConnector, type WalletKind } from "@/lib/wallet/capabilities";
import { walletKindLabel, walletKindNote } from "@/lib/wallet/labels";

const TAG_TONE: Record<ReadinessCopy["tone"], string> = {
  positive: "bg-accent-soft text-accent",
  attention: "bg-warning-bg text-warning-ink",
  neutral: "bg-line text-muted",
};

/** What the user can do now, plus the connected wallet in one line (replaces F1's wallet card). */
export function ReadinessCard({
  readiness,
  data,
  walletKind,
  account,
}: {
  readiness: Readiness;
  data: DashboardData;
  walletKind: WalletKind;
  account: Address;
}) {
  const { network } = useNetwork();
  const { connector, chainId } = useAccount();
  const { btcAddress } = useBitcoinAccount();
  const bitcoinWallet = connector ? isOrangeKitConnector(connector) : false;
  const copy = readinessCopy(readiness, { musd: data.snapshot.musd, walletKind, network });
  // The wrong-chain case has its own alert above the dashboard.
  const notes = [
    walletKindNote(walletKind, bitcoinWallet),
    writeBlocker(network, chainId) === "no-executor" ? writeBlockerMessage("no-executor", network) : null,
  ].filter((note): note is string => note !== null);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_TONE[copy.tone]}`}>{copy.tag}</span>
      <p className="mt-3 text-lg font-semibold leading-snug">{copy.headline}</p>
      {copy.detail && <p className="mt-1 text-sm text-muted">{copy.detail}</p>}
      {copy.action && (
        <div className="mt-4">
          <ExternalButton href={copy.action.href}>{copy.action.label}</ExternalButton>
        </div>
      )}
      <p className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span title={btcAddress ?? account}>
          {connector?.name ?? "Wallet"} · {walletKindLabel(walletKind, bitcoinWallet)} · {shortAddress(account)}
        </span>
        <span>BTC for gas {formatToken(data.gasBalance)}</span>
      </p>
      {notes.map((note) => (
        <p key={note} className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          {note}
        </p>
      ))}
    </section>
  );
}
```

Create `web/src/components/dashboard/Dashboard.tsx`:

```tsx
"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { useNetwork } from "@/lib/config/network-context";
import { readiness, troveWarning } from "@/lib/dashboard/readiness";
import { useDashboardSnapshot, type DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { dashboardView } from "@/lib/dashboard/view";
import { decodeError } from "@/lib/errors/decode";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ReadinessCard } from "./ReadinessCard";
import { TroveWarning } from "./TroveWarning";

/** The connected home page (spec §9 screen 1): warning, readiness, Trove, exposure. */
export function Dashboard({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const { data, error, refresh } = useDashboardSnapshot(account);
  const view = dashboardView({ hasData: data !== undefined, walletKindKnown: walletKind !== undefined, hasError: error !== null });

  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      {view === "content" && data && walletKind && <DashboardBody data={data} walletKind={walletKind} account={account} />}
      {view === "error" && error && <LoadError error={error} onRetry={refresh} />}
      {view === "loading" && <DashboardSkeleton />}
    </>
  );
}

function DashboardBody({ data, walletKind, account }: { data: DashboardData; walletKind: WalletKind; account: Address }) {
  const { snapshot, gasBalance, gasPrice } = data;
  const current = readiness({ snapshot, gasBalance, gasPrice, walletKind });
  const warning = troveWarning(current.health, snapshot.protocol.mcr);
  return (
    <>
      {warning && <TroveWarning warning={warning} />}
      <ReadinessCard readiness={current} data={data} walletKind={walletKind} account={account} />
    </>
  );
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { network } = useNetwork();
  return (
    <section role="alert" className="rounded-2xl bg-white p-5 shadow-card">
      <p className="text-sm">{decodeError(error, network).message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
      >
        Retry
      </button>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your positions" className="space-y-4">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-32 animate-pulse rounded-2xl bg-white shadow-card" />
      ))}
    </div>
  );
}
```

Replace `web/src/components/home/Home.tsx` with:

```tsx
"use client";

import { useAccount } from "wagmi";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ConnectHero } from "./ConnectHero";

export default function Home() {
  const { status, address } = useAccount();
  if (status === "connecting" || status === "reconnecting") {
    return <p className="text-sm text-muted">Connecting wallet…</p>;
  }
  if (status !== "connected" || !address) return <ConnectHero />;
  return <Dashboard account={address} />;
}
```

Delete F1's card: `git rm web/src/components/home/WalletCard.tsx`.

- [ ] **Step 7: Verify the whole web suite and the build**

Run: `cd web && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -15`
Expected:
- All test files pass.
- The build passes lint and the type check, and ends with the exported routes and the postbuild relayer check "OK".
- `git status --short` lists no `out 2` or `* 2.*` duplicates.

- [ ] **Step 8: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
# WalletCard.tsx was already staged for deletion by `git rm` in Step 6.
git add web/src/lib/dashboard/view.ts web/src/lib/dashboard/view.test.ts web/src/lib/dashboard/useDashboardSnapshot.ts web/src/components/ExternalButton.tsx web/src/components/dashboard/Dashboard.tsx web/src/components/dashboard/ReadinessCard.tsx web/src/components/dashboard/TroveWarning.tsx web/src/components/home/Home.tsx
git commit -m "feat(web): show readiness and the Trove warning on the dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Trove card and exposure panel

**Files:**
- Create: `web/src/components/dashboard/StatRow.tsx`
- Create: `web/src/components/dashboard/TroveCard.tsx`
- Create: `web/src/components/dashboard/ExposurePanel.tsx`
- Modify: `web/src/components/dashboard/Dashboard.tsx` (`DashboardBody`)

**Interfaces:**
- Consumes:
  - `formatToken`, `formatPercent`, `WAD` (Task 1);
  - `DashboardSnapshot` (Task 2);
  - `collateralRatio`, `liquidationPrice`, `TroveHealth`, `CR_SAFETY_FLOOR` (Task 3);
  - `exposure`, `drawdownScenarios`, `Scenario` (Task 4);
  - `Readiness` (Task 5);
  - `ExternalButton` (Task 7).
- Produces: `StatRow`, `TroveCard({ snapshot, borrowable, health })`, `ExposurePanel({ snapshot })`.

- [ ] **Step 1: Write the components**

Create `web/src/components/dashboard/StatRow.tsx`:

```tsx
import type { ReactNode } from "react";

/** One label/value pair in a card's `<dl>` grid, with an optional second line under the value. */
export function StatRow({
  label,
  sub,
  strong,
  children,
}: {
  label: string;
  sub?: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={strong ? "text-right font-semibold" : "text-right"}>
        {children}
        {sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </>
  );
}
```

Create `web/src/components/dashboard/TroveCard.tsx`:

```tsx
"use client";

import { ExternalButton } from "@/components/ExternalButton";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio, liquidationPrice, type TroveHealth } from "@/lib/trove/health";
import { StatRow } from "./StatRow";

const HEALTH_TAG: Record<TroveHealth, { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "bg-accent-soft text-accent" },
  "at-risk": { label: "At risk", tone: "bg-warning-bg text-warning-ink" },
  liquidatable: { label: "Liquidatable", tone: "bg-danger-soft text-danger" },
};

/** Collateral, debt, CR, liquidation price, and borrowing room (FR-03); rounding never flatters the Trove. */
export function TroveCard({
  snapshot,
  borrowable,
  health,
}: {
  snapshot: DashboardSnapshot;
  borrowable: bigint;
  health: TroveHealth | null;
}) {
  const { network } = useNetwork();
  const { trove, price, protocol } = snapshot;

  if (!trove) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Your Trove</h2>
        <p className="mt-2 text-sm text-muted">No open Trove.</p>
        <div className="mt-4">
          <ExternalButton href={network.mezoAppUrl}>Open Mezo app</ExternalButton>
        </div>
      </section>
    );
  }

  const cr = collateralRatio(trove, price);
  const liquidation = liquidationPrice(trove, protocol.mcr);
  const tag = health ? HEALTH_TAG[health] : null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center justify-between font-semibold">
        Your Trove
        {tag && <span className={`rounded-full px-2.5 py-1 text-xs ${tag.tone}`}>{tag.label}</span>}
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <StatRow label="Collateral" sub={`≈ ${formatToken((trove.collateral * price) / WAD, 18, 2)} MUSD`}>
          {formatToken(trove.collateral)} BTC
        </StatRow>
        <StatRow label="Debt" sub={`includes ${formatToken(trove.interest, 18, 2, "up")} MUSD interest`}>
          {formatToken(trove.debt, 18, 2, "up")} MUSD
        </StatRow>
        <StatRow label="Collateral ratio">{cr === null ? "—" : formatPercent(cr)}</StatRow>
        <StatRow label="Liquidation price">
          {liquidation === null ? "—" : `${formatToken(liquidation, 18, 0, "up")} MUSD / BTC`}
        </StatRow>
        <StatRow label="Borrowing room" sub={`keeps CR ≥ ${formatPercent(CR_SAFETY_FLOOR, 0)}`}>
          {formatToken(borrowable, 18, 2)} MUSD
        </StatRow>
      </dl>
    </section>
  );
}
```

Create `web/src/components/dashboard/ExposurePanel.tsx`:

```tsx
import type { ReactNode } from "react";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { drawdownScenarios, exposure } from "@/lib/exposure/exposure";
import { formatPercent, formatToken } from "@/lib/format";
import { collateralRatio } from "@/lib/trove/health";
import { StatRow } from "./StatRow";

const DOUBLE_EXPOSURE =
  "Borrowing MUSD against BTC and adding it to the MUSD/BTC pool raises your BTC exposure: a BTC drop lowers your collateral ratio and your LP value at the same time.";
const FOOTNOTE =
  "Estimates in MUSD. LP value uses the constant-product approximation (fees ignored). Stability Pool value does not model new liquidations caused by the drop.";

const btc = (value: bigint) => `${formatToken(value)} BTC`;
const musd = (value: bigint) => formatToken(value, 18, 2);
const price = (value: bigint) => formatToken(value, 18, 0);

/** Total BTC exposure and the 10/20/30% drawdown table (FR-15, PRODUCT_SPEC §12). */
export function ExposurePanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const current = exposure(snapshot);
  const scenarios = drawdownScenarios(snapshot, current);
  const hasTrove = snapshot.trove !== null;
  const hasLp = current.lpBtc > 0n || current.lpMusd > 0n;
  const hasSp = current.spDeposit > 0n || current.spBtcGain > 0n;
  const mcr = snapshot.protocol.mcr;

  if (!hasTrove && !hasLp && !hasSp) {
    return (
      <section id="exposure" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">BTC exposure</h2>
        <p className="mt-2 text-sm text-muted">No BTC exposure in a Trove, the LP, or the Stability Pool yet.</p>
      </section>
    );
  }

  const nowCr = snapshot.trove ? collateralRatio(snapshot.trove, snapshot.price) : null;
  return (
    <section id="exposure" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-baseline justify-between gap-3 font-semibold">
        BTC exposure
        <span className="text-xs font-normal text-muted">BTC {price(snapshot.price)} MUSD</span>
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {hasTrove && <StatRow label="Trove collateral">{btc(current.troveBtc)}</StatRow>}
        {hasLp && (
          <StatRow
            label="MUSD/BTC pool (your share)"
            sub={`+ ${musd(current.lpMusd)} MUSD · ≈ ${musd(current.lpValue)} MUSD`}
          >
            {btc(current.lpBtc)}
          </StatRow>
        )}
        {hasSp && (
          <StatRow label="Stability Pool BTC gain" sub={`deposit ${musd(current.spDeposit)} MUSD`}>
            {btc(current.spBtcGain)}
          </StatRow>
        )}
        <StatRow label="Total BTC exposure" strong>
          {btc(current.totalBtc)}
        </StatRow>
      </dl>
      <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{DOUBLE_EXPOSURE}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-xs">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 pr-2 text-left font-medium">If BTC drops</th>
              <th className="px-1.5 py-1.5 text-right font-medium">Now</th>
              {scenarios.map((s) => (
                <th key={s.dropPercent} className="px-1.5 py-1.5 text-right font-medium">
                  −{s.dropPercent}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="BTC price" now={price(snapshot.price)} cells={scenarios.map((s) => price(s.price))} />
            {hasTrove && (
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-2">Trove CR</td>
                <CrCell cr={nowCr} liquidatable={nowCr !== null && nowCr < mcr} />
                {scenarios.map((s) => (
                  <CrCell key={s.dropPercent} cr={s.collateralRatio} liquidatable={s.liquidatable} />
                ))}
              </tr>
            )}
            {hasLp && <Row label="LP value" now={musd(current.lpValue)} cells={scenarios.map((s) => musd(s.lpValue))} />}
            {hasSp && (
              <Row label="Stability Pool value" now={musd(current.spValue)} cells={scenarios.map((s) => musd(s.spValue))} />
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">{FOOTNOTE}</p>
    </section>
  );
}

function Row({ label, now, cells }: { label: string; now: ReactNode; cells: ReactNode[] }) {
  return (
    <tr className="border-b border-line/60">
      <td className="py-1.5 pr-2">{label}</td>
      <td className="px-1.5 py-1.5 text-right">{now}</td>
      {cells.map((cell, index) => (
        <td key={index} className="px-1.5 py-1.5 text-right">
          {cell}
        </td>
      ))}
    </tr>
  );
}

function CrCell({ cr, liquidatable }: { cr: bigint | null; liquidatable: boolean }) {
  if (cr === null) return <td className="px-1.5 py-1.5 text-right">—</td>;
  return (
    <td
      className={
        liquidatable
          ? "rounded-md bg-danger-soft px-1.5 py-1.5 text-right font-semibold text-danger"
          : "px-1.5 py-1.5 text-right"
      }
    >
      {formatPercent(cr)}
      {liquidatable && <span className="block text-[10px]">Liquidatable</span>}
    </td>
  );
}
```

In `web/src/components/dashboard/Dashboard.tsx`, add the imports `import { ExposurePanel } from "./ExposurePanel";` and `import { TroveCard } from "./TroveCard";`. Then make `DashboardBody` return:

```tsx
    <>
      {warning && <TroveWarning warning={warning} />}
      <ReadinessCard readiness={current} data={data} walletKind={walletKind} account={account} />
      <TroveCard snapshot={snapshot} borrowable={current.borrowable} health={current.health} />
      <ExposurePanel snapshot={snapshot} />
    </>
```

- [ ] **Step 2: Verify the suite and the build**

Run: `cd web && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -15`
Expected:
- All tests pass.
- The build passes lint and the type check; the postbuild relayer check passes.
- There are no `out 2` or `* 2.*` duplicates in `git status --short`.

- [ ] **Step 3: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/components/dashboard/StatRow.tsx web/src/components/dashboard/TroveCard.tsx web/src/components/dashboard/ExposurePanel.tsx web/src/components/dashboard/Dashboard.tsx
git commit -m "feat(web): add the Trove card and the BTC exposure panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Render the dashboard locally against the live testnet (throwaway edits, reverted)**

1. Start the dev server: `cd web && npm run dev` in the background.
2. Open `http://localhost:3000` with Playwright (`mcp__plugin_playwright_playwright__browser_navigate`). Confirm the disconnected page still renders the connect hero with no console errors (`browser_console_messages`).

A wallet cannot be connected in Playwright, so make two temporary edits to see the connected layout with real chain data. They must never be committed.

- In `web/src/components/home/Home.tsx`, return `<Dashboard account="0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49" />` as the first line of `Home` (the deployer account, which has a testnet Trove).
- In `web/src/components/dashboard/Dashboard.tsx`, change `const walletKind = useWalletKind();` to `const walletKind = useWalletKind() ?? "eoa";`. Without a connected wallet the kind is never known.

Reload the page and check:
- **Trove card:** about 0.045 BTC collateral, about 2,062.4x MUSD debt, a CR near 188%, and a borrowing room near 242 MUSD. These match `cast call 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 'getEntireDebtAndColl(address)(uint256,uint256,uint256,uint256,uint256,uint256)' 0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49 --rpc-url https://rpc.test.mezo.org`.
- **Exposure panel:** the panel and its 4-column drawdown table render.
- **Phone width:** at a 360 px viewport (`browser_resize` 360×800), `document.documentElement.scrollWidth <= 360` (via `browser_evaluate`).
- **Console:** no errors (`browser_console_messages`).

Then revert both throwaway edits and stop the dev server:

```bash
cd /Users/vanhuy/Desktop/mezoroute && git checkout -- web/src/components/home/Home.tsx web/src/components/dashboard/Dashboard.tsx && git status --short
```

Expected: `git status --short` prints nothing. If the check found a layout bug, fix it with its own `fix(web):` commit (build passing) before Task 9.

---

### Task 9: Docs, final verification, and the preview for QA

**Files:**
- Modify: `PRODUCT_SPEC.md` (§13 table, §21 open questions)
- Modify: `CLAUDE.md` (frontend notes)
- Modify: `docs/superpowers/specs/2026-10-05-f1-app-shell-design.md` (mark follow-up 2 closed)
- Modify: `docs/superpowers/specs/2026-10-05-f2-dashboard-design.md` (QA result line, after QA)

**Interfaces:**
- Consumes: everything above.
- Produces: docs only.

- [ ] **Step 1: Update the product spec**

In `PRODUCT_SPEC.md` §13, add a row after the "RPC unavailable" row:

```markdown
| BTC price feed stale | "The BTC price feed is temporarily unavailable." | Retry |
```

In §21, replace the line `- Final price-impact hard limit and CR safety floor after integration tests.` with:

```markdown
- Final price-impact hard limit after integration tests. The CR safety floor is set provisionally to 160% (F2, 5 Oct 2026): a borrow must leave the Trove able to survive a 30% BTC drop, and the dashboard shows a Trove as at risk when a 30% drop would put it below the MCR.
```

- [ ] **Step 2: Update CLAUDE.md and the F1 follow-up**

In `CLAUDE.md`, add this bullet after the "- Errors: …" bullet in the Frontend section:

```markdown
- Dashboard (F2): every read is one multicall snapshot (`src/lib/dashboard/snapshot.ts`), so all values come from one block; each call carries the selected network's `chainId`. Pool `token0` is MUSD on testnet but BTC on mainnet, so reserves are mapped by address. The CR safety floor (160%) and the at-risk rule (a 30% drop below MCR) live in `src/lib/trove/constants.ts`; F4 reuses them. Design: `docs/superpowers/specs/2026-10-05-f2-dashboard-design.md`.
```

In `docs/superpowers/specs/2026-10-05-f1-app-shell-design.md`, under "Follow-ups from the F1 review", append " Closed in F2 (5 Oct 2026)." to the end of the bullet that starts with "`decodeError` reports a bare `CallExecutionError`".

- [ ] **Step 3: Run the full verification**

Run: `cd web && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -12 && cd ../contracts && forge test 2>&1 | tail -3`
Expected:
- Every Vitest file passes. The count is F1's 187 plus the new tests.
- The web build passes with the relayer check OK.
- The Foundry tests still pass (untouched).
- `git status --short` shows only the doc edits, with no `* 2*` duplicates.

- [ ] **Step 4: Commit the docs**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add PRODUCT_SPEC.md CLAUDE.md docs/superpowers/specs/2026-10-05-f1-app-shell-design.md
git commit -m "docs: record the CR safety floor and the F2 dashboard notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy a Vercel preview**

Run (reads the WalletConnect ID from `.env.local` without printing it):

```bash
cd /Users/vanhuy/Desktop/mezoroute/web && vercel deploy --yes --build-env NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="$(sed -n 's/^NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=//p' .env.local)" 2>&1 | tail -3
cd /Users/vanhuy/Desktop/mezoroute && git status --short
```

Expected:
- A `https://mezoroute-….vercel.app` preview URL.
- `git status` is clean. If `vercel` appended `.env*` to `.gitignore`, revert that line.

- [ ] **Step 6: Hand the QA checklist to the user**

Give the user the preview URL and this checklist (spec §7). The user runs it; record the result in the F2 design doc's "Done when" section, then add the spec §16 line "F2 done <date>: dashboard with readiness, Trove card, and exposure panel; design in `docs/superpowers/specs/2026-10-05-f2-dashboard-design.md`." and commit both as `docs: record that F2 QA passed`.

1. **MetaMask with a testnet Trove** (faucet → open a Trove in the Mezo testnet app): the Trove numbers match the Mezo app; the exposure panel and drawdown table appear; readiness is `Ready` or `Can borrow`.
2. **MetaMask without a Trove or MUSD:** "You need MUSD to start." with Open Mezo app; the exposure panel shows its empty message.
3. **Unisat through Passport:** the wallet line reads "Bitcoin wallet (smart account)"; a Trove with room shows "Borrow it in the Mezo app first".
4. **Mainnet:** real numbers load, the "Mainnet actions open after launch" note shows, and there are no errors.
5. **MetaMask on another chain:** the Switch network alert shows above the dashboard, and the numbers still load.
6. **Phone width (360 px):** no horizontal page scroll; the drawdown table scrolls inside its card if needed.
