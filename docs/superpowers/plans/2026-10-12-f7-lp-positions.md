# F7 LP Positions, Fee Claims, and Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/positions/` page shows the user's MUSD/BTC LP (underlying, exit value, cost basis, estimated value change) and claimable pool fees with a Claim button; `/positions/lp/exit/` exits a share of the LP to MUSD in one `exit` transaction; the receipt page decodes `Exited` and the pool's `Claim`.

**Architecture:** Pure, unit-tested core: `lib/quote/exit.ts` (burn on balances + BTC→MUSD swap, replayed against a live `Exited`), `lib/positions/{fees,snapshot,history,cost-basis,view,claim,exit-*}.ts`. One multicall snapshot per page (claimable fees computed from the pool's fee indexes in the same block). Cost basis comes from executor `Entered`/`Exited` logs scanned over RPC in 10,000-block chunks clamped to the head and cached in `localStorage`. The F3 stepper becomes generic over its step kinds; the exit flow mirrors `useEntryFlow`.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, wagmi 2.19.5, viem 2.57.2, `@mezo-org/passport` 0.17.2, TanStack Query (via wagmi), Vitest 5, TypeScript 5.9.

**Spec:** `docs/superpowers/specs/2026-10-12-f7-lp-positions-design.md` (read it first; chain facts verified 12 Oct 2026). F3's design and code are the base: `docs/superpowers/specs/2026-10-05-f3-lp-route-design.md`.

## Global Constraints

- Branch `feat/f7-lp-positions` in `/Users/vanhuy/Desktop/mezoroute`; no worktree. Run `git branch --show-current` before each commit; stage explicit paths; no `* 2*` iCloud duplicates in `git status`.
- Commit prefixes `feat(web):`, `fix(web):`, `test(web):`, `docs:`; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency changes, no contract changes. Addresses only from `network.addresses` / `network.executor`.
- All amounts and ratios are `bigint` (1e18 = 1 MUSD / 100%). Copy in English; never "profit", "APY", "guaranteed", "risk-free"; pre-transaction values are "estimated"; the cost-basis difference is "Estimated position value change".
- Token order is mapped by address (`musdIsToken0`): testnet token0 is MUSD, mainnet token0 is BTC.
- Transaction and signature deadline: snapshot block timestamp + `DEADLINE_SECONDS` (600 s); a permit is used only with 60 s to spare (`permitUsable`). Exit recipient is always the pinned account. No fee on exit.
- `eth_getLogs` ranges: at most `LOG_RANGE` = 10,000 blocks and **never above the head** (a range past the head returns an empty list without an error).
- Mainnet stays read-only until M1: Claim and Exit go through `writeBlocker`.
- Never let `WagmiProvider` re-render (CLAUDE.md); new pages load their component with `next/dynamic` and `ssr: false`, like `app/route/lp/page.tsx`.
- Run `npm` from `web/`. UI tasks also run `npm run build` (lint + type check). Never build while `npm run dev` runs. The repo does not use prettier.

## Review Focus

- **Max exits exactly the LP balance**, never one wei less (dust stuck) or more (revert). Pinned in Task 5 (`exitLiquidity(balance, 100) === balance`).
- **A log range above the head silently returns nothing**, so the scan must clamp. Pinned in Task 3 (`scanRanges` never ends above the head).
- **A failed log chunk must not produce a partial history presented as complete**, and must not poison the cache. Pinned in Task 3 (`loadHistory` rejects after three attempts and returns no cache).
- **Mainnet token order**: fees and `Claim` amounts are mapped by token address. Pinned in Task 2 (`claimableFees` on mainnet) and Task 6 (`findClaimEvent` on mainnet).
- **The LP balance shrinks between signing and sending** (pinned `liquidityIn` > balance): blocked with "Your LP balance changed", not sent to revert. Pinned in Task 5 (gate `lp-changed`).

---

### Task 1: Exit quote engine and gas (`lib/quote/exit.ts`)

**Files:**
- Create: `web/src/lib/quote/exit.ts`
- Modify: `web/src/lib/quote/gas.ts`
- Test: `web/src/lib/quote/exit.test.ts`

**Interfaces:**
- Consumes: `PoolState` from `./entry`; `ceilDiv`, `WAD` from `@/lib/math`; `APPROVE_GAS`, `RELAYED_CALL_GAS` in `./gas`.
- Produces:
  - `type ExitPool = PoolState & { balanceMusd: bigint; balanceBtc: bigint }`
  - `type ExitQuote = { liquidityIn: bigint; musdRemoved: bigint; btcRemoved: bigint; musdFromSwap: bigint; musdOut: bigint; priceImpact: bigint }`
  - `type ExitMinimums = { minMusdRemoved: bigint; minBtcRemoved: bigint; minMusdFromSwap: bigint; minMusdOut: bigint }`
  - `quoteExit(pool: ExitPool, liquidityIn: bigint): ExitQuote | null`
  - `exitMinimums(quote: ExitQuote, slippageBps: bigint): ExitMinimums`
  - `EXIT_GAS = 400_000n`; `exitGasUnits(input: { approve: boolean; smartAccount: boolean }): bigint`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/quote/exit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exitMinimums, quoteExit, type ExitPool } from "./exit";
import { exitGasUnits } from "./gas";

// The testnet pool at block 15903030, the block before the live smoke exit (tx 0x38a45ffe…7e30,
// read with `cast` on 12 Oct 2026). Reserves equal balances there.
const POOL: ExitPool = {
  reserveMusd: 102598256665495665120330482n,
  reserveBtc: 1302678885923892497596n,
  balanceMusd: 102598256665495665120330482n,
  balanceBtc: 1302678885923892497596n,
  totalSupply: 365577894146642543892826n,
  feeBps: 4n,
};
const LIVE_LIQUIDITY = 71164200333222588n;

describe("quoteExit", () => {
  it("replays the live smoke Exited event to the wei", () => {
    expect(quoteExit(POOL, LIVE_LIQUIDITY)).toEqual({
      liquidityIn: LIVE_LIQUIDITY,
      musdRemoved: 19972003253167101669n,
      btcRemoved: 253582349184825n,
      musdFromSwap: 19964010567181212457n,
      musdOut: 39936013820348314126n,
      priceImpact: 400194506506446n,
    });
  });

  it("burns pro rata of the token balances, not the reserves", () => {
    const donated = { ...POOL, balanceMusd: POOL.balanceMusd + 10n ** 24n };
    expect(quoteExit(donated, LIVE_LIQUIDITY)?.musdRemoved).toBe((LIVE_LIQUIDITY * donated.balanceMusd) / POOL.totalSupply);
  });

  it("returns null when Pool.burn would revert because one side rounds to zero", () => {
    expect(quoteExit(POOL, 1n)).toBeNull(); // 280 wei MUSD, 0 BTC
    expect(quoteExit(POOL, 300n)?.btcRemoved).toBe(1n);
  });

  it("returns null without liquidity or above the supply", () => {
    expect(quoteExit(POOL, 0n)).toBeNull();
    expect(quoteExit(POOL, POOL.totalSupply + 1n)).toBeNull();
    expect(quoteExit({ ...POOL, totalSupply: 0n }, 1n)).toBeNull();
  });
});

describe("exitMinimums", () => {
  it("takes the slippage off each expected value, rounded down", () => {
    expect(exitMinimums(quoteExit(POOL, LIVE_LIQUIDITY)!, 100n)).toEqual({
      minMusdRemoved: 19772283220635430652n,
      minBtcRemoved: 251046525692976n,
      minMusdFromSwap: 19764370461509400332n,
      minMusdOut: 39536653682144830984n,
    });
  });
});

describe("exitGasUnits", () => {
  it("adds the approval and the relayer's overhead per relayed call", () => {
    expect(exitGasUnits({ approve: false, smartAccount: false })).toBe(400_000n);
    expect(exitGasUnits({ approve: true, smartAccount: true })).toBe(400_000n + 60_000n + 2n * 197_471n);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/quote/exit.test.ts`
Expected: FAIL (cannot resolve `./exit`, and `exitGasUnits` is not exported).

- [ ] **Step 3: Implement**

Create `web/src/lib/quote/exit.ts`:

```ts
import { ceilDiv, WAD } from "@/lib/math";
import type { PoolState } from "./entry";

const BPS = 10_000n;

/** The pool as `exit` sees it: Pool.burn pays a share of the token balances, not of the reserves. */
export type ExitPool = PoolState & { balanceMusd: bigint; balanceBtc: bigint };

export type ExitQuote = {
  liquidityIn: bigint;
  musdRemoved: bigint;
  btcRemoved: bigint;
  musdFromSwap: bigint;
  musdOut: bigint; // musdRemoved + musdFromSwap
  priceImpact: bigint; // the BTC→MUSD swap against the pre-exit mid price; 1e18 = 100%, rounded up
};

export type ExitMinimums = { minMusdRemoved: bigint; minBtcRemoved: bigint; minMusdFromSwap: bigint; minMusdOut: bigint };

/**
 * The executor's exit with the contracts' rounding: Pool.burn pays `liquidity × balance / supply`
 * per token and sets the reserves to the new balances; the BTC is then sold on those reserves with
 * the fee taken out first (Pool.getAmountOut). Null where `burn` or the swap would revert.
 */
export function quoteExit(pool: ExitPool, liquidityIn: bigint): ExitQuote | null {
  if (liquidityIn <= 0n || pool.totalSupply === 0n || liquidityIn > pool.totalSupply) return null;
  const musdRemoved = (liquidityIn * pool.balanceMusd) / pool.totalSupply;
  const btcRemoved = (liquidityIn * pool.balanceBtc) / pool.totalSupply;
  if (musdRemoved === 0n || btcRemoved === 0n) return null; // InsufficientLiquidityBurned
  const reserveMusd = pool.balanceMusd - musdRemoved;
  const reserveBtc = pool.balanceBtc - btcRemoved;
  const swapIn = btcRemoved - (btcRemoved * pool.feeBps) / BPS;
  const musdFromSwap = (swapIn * reserveMusd) / (reserveBtc + swapIn);
  if (musdFromSwap === 0n) return null;
  return {
    liquidityIn,
    musdRemoved,
    btcRemoved,
    musdFromSwap,
    musdOut: musdRemoved + musdFromSwap,
    priceImpact: exitPriceImpact(pool, btcRemoved, musdFromSwap),
  };
}

/** 1 − musdFromSwap × R_btc / (btcIn × R_musd), against the reserves before the exit. */
function exitPriceImpact(pool: PoolState, btcIn: bigint, musdFromSwap: bigint): bigint {
  const atMid = btcIn * pool.reserveMusd;
  const received = musdFromSwap * pool.reserveBtc;
  return atMid > received ? ceilDiv((atMid - received) * WAD, atMid) : 0n;
}

/** Each expected value minus the slippage, rounded down (the four minimums of ExitParams). */
export function exitMinimums(quote: ExitQuote, slippageBps: bigint): ExitMinimums {
  const floor = (value: bigint) => (value * (BPS - slippageBps)) / BPS;
  return {
    minMusdRemoved: floor(quote.musdRemoved),
    minBtcRemoved: floor(quote.btcRemoved),
    minMusdFromSwap: floor(quote.musdFromSwap),
    minMusdOut: floor(quote.musdOut),
  };
}
```

Append to `web/src/lib/quote/gas.ts`:

```ts
/** `exit`: 350,049 measured on testnet with an approval (2 Oct 2026); Task 10 of F7 re-measures it with a permit. */
export const EXIT_GAS = 400_000n;

/** Estimated gas units for the whole exit flow, for the preview's network-fee line. */
export function exitGasUnits(input: { approve: boolean; smartAccount: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = EXIT_GAS + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/quote/exit.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/quote/exit.ts web/src/lib/quote/exit.test.ts web/src/lib/quote/gas.ts
git commit -m "feat(web): quote an LP exit with the pool's exact rounding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pool ABI, LP permit, claimable fees, positions snapshot

**Files:**
- Modify: `web/src/lib/abi/pool.ts`, `web/src/lib/config/networks.ts`, `web/src/lib/config/networks.test.ts`, `web/src/lib/dashboard/snapshot.ts`
- Create: `web/src/lib/positions/lp-permit.ts`, `web/src/lib/positions/fees.ts`, `web/src/lib/positions/snapshot.ts`, `web/src/lib/positions/test-fixtures.ts`
- Test: `web/src/lib/positions/lp-permit.test.ts`, `web/src/lib/positions/fees.test.ts`, `web/src/lib/positions/snapshot.test.ts`

**Interfaces:**
- Consumes: `ExitPool` (Task 1); `PERMIT_TYPES` from `@/lib/routes/musd-btc-lp/permit`; `multicall3BlockAbi`; `priceFeedAbi`, `poolFactoryAbi`.
- Produces:
  - `poolAbi` gains `claimFees`, `index0/1`, `supplyIndex0/1`, `claimable0/1`, `nonces`, `allowance`, `event Claim(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1)`
  - `NetworkConfig["executor"]` gains `deployBlock: bigint` (testnet `15_903_010n`)
  - `musdIsToken0(network: NetworkConfig): boolean` (exported from `@/lib/dashboard/snapshot`)
  - `lpPermitDomain(network)`, `lpPermitTypedData({ network, owner, spender, value, nonce, deadline })`
  - `type Fees = { musd: bigint; btc: bigint }`; `type FeeState = { lpBalance; index0; index1; supplyIndex0; supplyIndex1; claimable0; claimable1 }` (all `bigint`); `claimableFees(network, state: FeeState): Fees`
  - `type PositionsSnapshot = { price: bigint; lpBalance: bigint; pool: ExitPool; fees: Fees; allowance: bigint; permitNonce: bigint; blockNumber: bigint; blockTimestamp: bigint }`
  - `type PositionsData = { snapshot: PositionsSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number }`
  - `positionsContracts(network, account)`, `type PositionsResults`, `parsePositionsSnapshot(network, results)`
  - Fixtures: `LIVE_EXIT_POOL`, `LIVE_EXIT_LIQUIDITY`, `positionsSnapshotWith(overrides)`, `positionsDataWith(overrides)`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/positions/lp-permit.test.ts`:

```ts
import { domainSeparator, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lpPermitDomain, lpPermitTypedData } from "./lp-permit";

const testnet = networks.testnet;
// Anvil's first well-known test key; it holds nothing on Mezo.
const signer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcaa1db8b7d5ce6b5f");
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";

describe("lpPermitDomain", () => {
  it("hashes to the pool's DOMAIN_SEPARATOR() on testnet (cast, 12 Oct 2026)", () => {
    expect(domainSeparator({ domain: lpPermitDomain(testnet) })).toBe(
      "0x4f950a79ec8129e56185827b701ba8fc3158291539b5483d715b8e48c2b67131",
    );
  });
});

describe("lpPermitTypedData", () => {
  it("produces a permit for the executor that recovers to the owner", async () => {
    const typedData = lpPermitTypedData({
      network: testnet,
      owner: signer.address,
      spender: EXECUTOR,
      value: 7n,
      nonce: 0n,
      deadline: 1_791_778_000n,
    });
    expect(typedData.domain.verifyingContract).toBe(testnet.addresses.pool);
    const signature = await signer.signTypedData(typedData);
    expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(signer.address);
  });
});
```

Create `web/src/lib/positions/fees.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { claimableFees, type FeeState } from "./fees";

// LP 0x72D8…Cd2c on testnet at block 16112427 (cast, 12 Oct 2026); `claimFees()` simulated from it
// returned (18526950177266249, 28708139080).
const LIVE: FeeState = {
  lpBalance: 9370591955800361344281n,
  index0: 1731822510731387278n,
  index1: 97052834217934n,
  supplyIndex0: 1731820533593735286n,
  supplyIndex1: 97052831154292n,
  claimable0: 0n,
  claimable1: 0n,
};

describe("claimableFees", () => {
  it("matches the live claimFees() simulation (testnet token0 is MUSD)", () => {
    expect(claimableFees(networks.testnet, LIVE)).toEqual({ musd: 18526950177266249n, btc: 28708139080n });
  });

  it("adds the stored claimable to the accrued share", () => {
    expect(claimableFees(networks.testnet, { ...LIVE, claimable0: 5n, claimable1: 7n })).toEqual({
      musd: 18526950177266254n,
      btc: 28708139087n,
    });
  });

  it("maps by token address on mainnet, where token0 is BTC", () => {
    expect(claimableFees(networks.mainnet, LIVE)).toEqual({ musd: 28708139080n, btc: 18526950177266249n });
  });

  it("accrues nothing without LP; stored fees stay claimable after a full exit", () => {
    expect(claimableFees(networks.testnet, { ...LIVE, lpBalance: 0n, claimable0: 73915791430n, claimable1: 3690796n })).toEqual({
      musd: 73915791430n,
      btc: 3690796n,
    });
  });
});
```

Create `web/src/lib/positions/snapshot.test.ts`:

```ts
import { encodeFunctionData, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { FIXTURE_PRICE } from "@/lib/dashboard/test-fixtures";
import { parsePositionsSnapshot, positionsContracts, type PositionsResults } from "./snapshot";

const ACCOUNT = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
const ONE = 10n ** 18n;

function results(reserves: readonly [bigint, bigint, bigint]): PositionsResults {
  return [
    FIXTURE_PRICE,
    2n * ONE, // LP balance
    1_000n * ONE, // total supply
    reserves,
    520n * ONE, // pool MUSD balance
    6_000_000_000_000_000n, // pool BTC balance
    4n, // fee bps
    3n * ONE, // index0
    5n * ONE, // index1
    2n * ONE, // supplyIndex0
    4n * ONE, // supplyIndex1
    10n, // claimable0
    20n, // claimable1
    9n, // allowance
    1n, // permit nonce
    15936716n,
    1_759_600_000n,
  ];
}

describe("positionsContracts", () => {
  it("reads only allowlisted addresses on the selected network", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = positionsContracts(network, ACCOUNT);
      expect(calls).toHaveLength(17);
      for (const call of calls) {
        expect(call.chainId).toBe(network.chainId);
        expect(Object.values(network.addresses)).toContain(call.address);
      }
    }
  });

  it("encodes every call against its ABI", () => {
    for (const call of positionsContracts(networks.testnet, ACCOUNT)) {
      expect(() => encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0])).not.toThrow();
    }
  });

  it("reads the LP allowance to the executor, or to the zero address before one is deployed", () => {
    const allowance = (network: (typeof networks)["testnet"]) => {
      const call = positionsContracts(network, ACCOUNT).find((item) => item.functionName === "allowance");
      return call && "args" in call ? call.args : undefined;
    };
    expect(allowance(networks.testnet)).toEqual([ACCOUNT, networks.testnet.executor!.address]);
    expect(allowance(networks.mainnet)).toEqual([ACCOUNT, zeroAddress]);
  });
});

describe("parsePositionsSnapshot", () => {
  it("maps reserves and fees by token on testnet (MUSD is token0)", () => {
    const parsed = parsePositionsSnapshot(networks.testnet, results([520n * ONE, 6_000_000_000_000_000n, 1n]));
    expect(parsed.pool).toEqual({
      reserveMusd: 520n * ONE,
      reserveBtc: 6_000_000_000_000_000n,
      balanceMusd: 520n * ONE,
      balanceBtc: 6_000_000_000_000_000n,
      totalSupply: 1_000n * ONE,
      feeBps: 4n,
    });
    // claimable + balance × (index − supplyIndex) / 1e18 = 10 + 2e18, 20 + 2e18
    expect(parsed.fees).toEqual({ musd: 2n * ONE + 10n, btc: 2n * ONE + 20n });
    expect(parsed).toMatchObject({ price: FIXTURE_PRICE, lpBalance: 2n * ONE, allowance: 9n, permitNonce: 1n, blockNumber: 15936716n });
  });

  it("swaps reserves and fees on mainnet (BTC is token0)", () => {
    const parsed = parsePositionsSnapshot(networks.mainnet, results([6_000_000_000_000_000n, 520n * ONE, 1n]));
    expect(parsed.pool.reserveMusd).toBe(520n * ONE);
    expect(parsed.pool.reserveBtc).toBe(6_000_000_000_000_000n);
    expect(parsed.fees).toEqual({ musd: 2n * ONE + 20n, btc: 2n * ONE + 10n });
  });
});
```

In `web/src/lib/config/networks.test.ts`, change the executor expectation to include the deployment block:

```ts
    expect(networks.testnet.executor).toEqual({
      address: "0xB36B2E012003840951CFf00fA6b1E3237A110920",
      feeBps: 10n,
      deployBlock: 15_903_010n,
    });
```

(Keep the test's other lines; read it first and edit only the object literal.)

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/positions src/lib/config/networks.test.ts`
Expected: FAIL (modules `./lp-permit`, `./fees`, `./snapshot` not found; `deployBlock` missing).

- [ ] **Step 3: Implement**

In `web/src/lib/abi/pool.ts`, replace `poolAbi` with:

```ts
/** Tigris Pool: the pool contract is also the LP token (ERC20Permit), and it pays its swap fees on `claimFees`. */
export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function index0() view returns (uint256)",
  "function index1() view returns (uint256)",
  "function supplyIndex0(address account) view returns (uint256)",
  "function supplyIndex1(address account) view returns (uint256)",
  "function claimable0(address account) view returns (uint256)",
  "function claimable1(address account) view returns (uint256)",
  "function claimFees() returns (uint256 claimed0, uint256 claimed1)",
  "event Claim(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1)",
]);
```

In `web/src/lib/config/networks.ts`, change the executor type and the testnet value:

```ts
  /**
   * Pinned executor, its fee (F3 compares the fee with the chain before writing), and its deployment
   * block (F7 scans its events from there); null until deployed.
   */
  executor: { address: Address; feeBps: bigint; deployBlock: bigint } | null;
```

```ts
    executor: { address: "0xB36B2E012003840951CFf00fA6b1E3237A110920", feeBps: 10n, deployBlock: 15_903_010n },
```

In `web/src/lib/dashboard/snapshot.ts`, export the token-order helper and use it in `parseSnapshot`:

```ts
/** Tigris sorts a pair by address: testnet's token0 is MUSD, mainnet's is BTC. */
export function musdIsToken0(network: NetworkConfig): boolean {
  return BigInt(network.addresses.musd) < BigInt(network.addresses.btc);
}
```

and in `parseSnapshot` replace the two lines

```ts
  // Tigris sorts a pair by address: testnet's token0 is MUSD, mainnet's is BTC.
  const musdIsToken0 = BigInt(network.addresses.musd) < BigInt(network.addresses.btc);
```

with

```ts
  const musdFirst = musdIsToken0(network);
```

and rename the two uses below (`musdIsToken0 ? reserves[0] : reserves[1]`, `musdIsToken0 ? reserves[1] : reserves[0]`) to `musdFirst`.

Create `web/src/lib/positions/lp-permit.ts`:

```ts
import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import { PERMIT_TYPES } from "@/lib/routes/musd-btc-lp/permit";

/**
 * The LP token's EIP-712 domain. Tigris pools are OpenZeppelin `ERC20Permit("")`: `eip712Domain()`
 * returns name "" and version "1" (testnet, 12 Oct 2026). Check mainnet before M1.
 */
export function lpPermitDomain(network: NetworkConfig) {
  return { name: "", version: "1", chainId: network.chainId, verifyingContract: network.addresses.pool } as const;
}

/** EIP-2612 permit for exactly `value` LP to the executor (Flow G step 3). */
export function lpPermitTypedData(input: {
  network: NetworkConfig;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: lpPermitDomain(input.network),
    types: PERMIT_TYPES,
    primaryType: "Permit" as const,
    message: {
      owner: input.owner,
      spender: input.spender,
      value: input.value,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}
```

Create `web/src/lib/positions/fees.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";

export type Fees = { musd: bigint; btc: bigint };

/** The pool's fee accounting for one account, as read in the snapshot (token0/token1 order). */
export type FeeState = {
  lpBalance: bigint;
  index0: bigint;
  index1: bigint;
  supplyIndex0: bigint;
  supplyIndex1: bigint;
  claimable0: bigint;
  claimable1: bigint;
};

/**
 * What `claimFees()` would pay now, mirroring Pool._updateFor: the stored claimable plus
 * `balance × (index − supplyIndex) / 1e18` per token. LP transfers run `_updateFor`, so fees stay
 * claimable after an exit.
 */
export function claimableFees(network: NetworkConfig, state: FeeState): Fees {
  const accrued = (index: bigint, supplyIndex: bigint) =>
    state.lpBalance > 0n && index > supplyIndex ? (state.lpBalance * (index - supplyIndex)) / WAD : 0n;
  const amount0 = state.claimable0 + accrued(state.index0, state.supplyIndex0);
  const amount1 = state.claimable1 + accrued(state.index1, state.supplyIndex1);
  return musdIsToken0(network) ? { musd: amount0, btc: amount1 } : { musd: amount1, btc: amount0 };
}
```

Create `web/src/lib/positions/snapshot.ts`:

```ts
import { erc20Abi, zeroAddress, type Address } from "viem";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { priceFeedAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import type { ExitPool } from "@/lib/quote/exit";
import { claimableFees, type Fees } from "./fees";

/** Everything the positions pages read, from one block. */
export type PositionsSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  lpBalance: bigint;
  pool: ExitPool;
  fees: Fees; // what claimFees() would pay at this block
  allowance: bigint; // LP the executor may already pull
  permitNonce: bigint; // LP EIP-2612 nonce of the account
  blockNumber: bigint;
  blockTimestamp: bigint;
};

export type PositionsData = { snapshot: PositionsSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

export type PositionsResults = readonly [
  price: bigint,
  lpBalance: bigint,
  totalSupply: bigint,
  reserves: readonly [bigint, bigint, bigint],
  poolMusd: bigint,
  poolBtc: bigint,
  feeBps: bigint,
  index0: bigint,
  index1: bigint,
  supplyIndex0: bigint,
  supplyIndex1: bigint,
  claimable0: bigint,
  claimable1: bigint,
  allowance: bigint,
  permitNonce: bigint,
  blockNumber: bigint,
  blockTimestamp: bigint,
];

/** One multicall on the selected network. Without an executor (mainnet before M1) the allowance is read for the zero address. */
export function positionsContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  const spender = network.executor?.address ?? zeroAddress;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [a.pool] },
    { chainId, address: a.btc, abi: erc20Abi, functionName: "balanceOf", args: [a.pool] },
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "index0" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "index1" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "supplyIndex0", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "supplyIndex1", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "claimable0", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "claimable1", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "allowance", args: [account, spender] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "nonces", args: [account] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
  ] as const;
}

export function parsePositionsSnapshot(network: NetworkConfig, results: PositionsResults): PositionsSnapshot {
  const [
    price,
    lpBalance,
    totalSupply,
    reserves,
    poolMusd,
    poolBtc,
    feeBps,
    index0,
    index1,
    supplyIndex0,
    supplyIndex1,
    claimable0,
    claimable1,
    allowance,
    permitNonce,
    blockNumber,
    blockTimestamp,
  ] = results;
  const musdFirst = musdIsToken0(network);
  return {
    price,
    lpBalance,
    pool: {
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
      balanceMusd: poolMusd,
      balanceBtc: poolBtc,
      totalSupply,
      feeBps,
    },
    fees: claimableFees(network, { lpBalance, index0, index1, supplyIndex0, supplyIndex1, claimable0, claimable1 }),
    allowance,
    permitNonce,
    blockNumber,
    blockTimestamp,
  };
}
```

Create `web/src/lib/positions/test-fixtures.ts`:

```ts
import type { ExitPool } from "@/lib/quote/exit";
import type { PositionsData, PositionsSnapshot } from "./snapshot";

// Test data only: the testnet pool at block 15903030, before the live smoke exit (cast, 12 Oct 2026).

export const ONE = 10n ** 18n;

export const LIVE_EXIT_POOL: ExitPool = {
  reserveMusd: 102598256665495665120330482n,
  reserveBtc: 1302678885923892497596n,
  balanceMusd: 102598256665495665120330482n,
  balanceBtc: 1302678885923892497596n,
  totalSupply: 365577894146642543892826n,
  feeBps: 4n,
};

/** The live exit's liquidityIn (tx 0x38a45ffe…7e30). */
export const LIVE_EXIT_LIQUIDITY = 71164200333222588n;

export function positionsSnapshotWith(overrides: Partial<PositionsSnapshot> = {}): PositionsSnapshot {
  return {
    price: 78_759_000n * 10n ** 15n, // 78,759 MUSD per BTC, close to the pool's price
    lpBalance: 2n * LIVE_EXIT_LIQUIDITY,
    pool: LIVE_EXIT_POOL,
    fees: { musd: 0n, btc: 0n },
    allowance: 0n,
    permitNonce: 0n,
    blockNumber: 15903030n,
    blockTimestamp: 1_790_903_700n,
    ...overrides,
  };
}

/** Enough BTC for the gas budget at 146 wei. */
export function positionsDataWith(overrides: Partial<PositionsData> = {}): PositionsData {
  return { snapshot: positionsSnapshotWith(), gasBalance: ONE / 1_000n, gasPrice: 146n, fetchedAt: 1_000_000, ...overrides };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/positions src/lib/config src/lib/dashboard`
Expected: PASS (all; the dashboard tests prove the `musdIsToken0` refactor kept behaviour).

- [ ] **Step 5: Type check and commit**

Run: `cd web && npx tsc --noEmit`
Expected: no errors (every `executor` literal in tests already passes through `networks`; if a test builds its own `NetworkConfig` with an executor, add `deployBlock: 0n` there and note it in the ledger).

```bash
git add web/src/lib/abi/pool.ts web/src/lib/config/networks.ts web/src/lib/config/networks.test.ts web/src/lib/dashboard/snapshot.ts web/src/lib/positions
git commit -m "feat(web): read the LP position and its claimable fees in one snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Executor event history (`lib/positions/history.ts`)

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/receipt.ts` (add the `ExitedEvent` type only)
- Create: `web/src/lib/positions/history.ts`, `web/src/lib/positions/history-reader.ts`
- Test: `web/src/lib/positions/history.test.ts`, `web/src/lib/positions/history-reader.test.ts`

**Interfaces:**
- Consumes: `EnteredEvent` from `@/lib/routes/musd-btc-lp/receipt`; `mezoRouteExecutorAbi`; `NetworkConfig`.
- Produces:
  - `type ExitedEvent = { caller: Address; recipient: Address; liquidityIn: bigint; musdRemoved: bigint; btcRemoved: bigint; musdFromSwap: bigint; musdOut: bigint; btcRefund: bigint }` (in `receipt.ts`)
  - `LOG_RANGE = 10_000n`, `REORG_MARGIN = 50n`, `SCAN_CONCURRENCY = 6`
  - `type BlockRange = { fromBlock: bigint; toBlock: bigint }`
  - `type HistoryEvent = { kind: "entered"; blockNumber: bigint; logIndex: number; event: EnteredEvent } | { kind: "exited"; blockNumber: bigint; logIndex: number; event: ExitedEvent }`
  - `type HistoryCache = { scannedTo: bigint; events: HistoryEvent[] }`
  - `type ReadChunk = (range: BlockRange) => Promise<HistoryEvent[]>`
  - `scanRanges(from, head, size?)`, `readRanges(read, ranges, concurrency?)`, `mergeHistory(cache, fresh, head, deployBlock)`, `loadHistory({ read, head, deployBlock, cache })` → `Promise<{ events: HistoryEvent[]; cache: HistoryCache | null }>`
  - `historyKey(network, executor, account): string`, `serializeHistory(cache): string`, `parseHistory(text: string | null): HistoryCache | null`
  - `type LogsClient = { getLogs: PublicClient["getLogs"] }`; `readExecutorEvents(client, executor, account, range): Promise<HistoryEvent[]>`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/positions/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import {
  historyKey,
  loadHistory,
  mergeHistory,
  parseHistory,
  readRanges,
  scanRanges,
  serializeHistory,
  type BlockRange,
  type HistoryEvent,
} from "./history";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const DEPLOY = 15_903_010n;

function entered(blockNumber: bigint, logIndex = 0): HistoryEvent {
  const event: EnteredEvent = {
    caller: ME,
    recipient: ME,
    musdBorrowed: 0n,
    musdIn: 20n,
    fee: 0n,
    musdSwapped: 10n,
    btcFromSwap: 1n,
    musdAdded: 10n,
    btcAdded: 1n,
    liquidityOut: 3n,
    musdRefund: 0n,
    btcRefund: 0n,
  };
  return { kind: "entered", blockNumber, logIndex, event };
}

describe("scanRanges", () => {
  it("splits into 10,000-block ranges that never end above the head", () => {
    // Mezo's RPC answers a range past the head with an empty list and no error (12 Oct 2026).
    expect(scanRanges(DEPLOY, 15_925_000n)).toEqual([
      { fromBlock: 15_903_010n, toBlock: 15_913_009n },
      { fromBlock: 15_913_010n, toBlock: 15_923_009n },
      { fromBlock: 15_923_010n, toBlock: 15_925_000n },
    ]);
  });

  it("covers a single block and nothing when the start is past the head", () => {
    expect(scanRanges(10n, 10n)).toEqual([{ fromBlock: 10n, toBlock: 10n }]);
    expect(scanRanges(11n, 10n)).toEqual([]);
  });
});

describe("readRanges", () => {
  const ranges: BlockRange[] = scanRanges(0n, 99n, 10n);

  it("reads at most `concurrency` ranges at once and returns events sorted by block and log", async () => {
    let active = 0;
    let peak = 0;
    const events = await readRanges(
      async (range) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return range.fromBlock === 50n ? [entered(55n, 2), entered(55n, 1)] : range.fromBlock === 10n ? [entered(12n)] : [];
      },
      ranges,
      3,
    );
    expect(peak).toBe(3);
    expect(events.map((item) => [item.blockNumber, item.logIndex])).toEqual([
      [12n, 0],
      [55n, 1],
      [55n, 2],
    ]);
  });

  it("retries a failing range, then gives up after three attempts", async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) throw new Error("rpc");
      return [entered(1n)];
    };
    await expect(readRanges(flaky, [{ fromBlock: 0n, toBlock: 9n }])).resolves.toHaveLength(1);
    await expect(readRanges(async () => Promise.reject(new Error("down")), [{ fromBlock: 0n, toBlock: 9n }])).rejects.toThrow("down");
  });
});

describe("mergeHistory", () => {
  it("caches only events at least REORG_MARGIN blocks below the head", () => {
    const { events, cache } = mergeHistory(null, [entered(900n), entered(980n)], 1_000n, 0n);
    expect(events.map((item) => item.blockNumber)).toEqual([900n, 980n]);
    expect(cache).toEqual({ scannedTo: 950n, events: [entered(900n)] });
  });

  it("keeps the old cache when the head has not moved past the margin", () => {
    const old = { scannedTo: 990n, events: [entered(900n)] };
    expect(mergeHistory(old, [entered(1_010n)], 1_020n, 0n)).toEqual({ events: [entered(900n), entered(1_010n)], cache: old });
  });
});

describe("loadHistory", () => {
  it("scans from the deployment block without a cache, from after the cache with one", async () => {
    const seen: BlockRange[] = [];
    const read = async (range: BlockRange) => {
      seen.push(range);
      return [];
    };
    await loadHistory({ read, head: DEPLOY + 5n, deployBlock: DEPLOY, cache: null });
    await loadHistory({ read, head: 2_000n, deployBlock: 0n, cache: { scannedTo: 1_500n, events: [] } });
    expect(seen).toEqual([
      { fromBlock: DEPLOY, toBlock: DEPLOY + 5n },
      { fromBlock: 1_501n, toBlock: 2_000n },
    ]);
  });

  it("rejects, and so writes no cache, when a range keeps failing", async () => {
    await expect(
      loadHistory({ read: async () => Promise.reject(new Error("down")), head: 100n, deployBlock: 0n, cache: null }),
    ).rejects.toThrow("down");
  });
});

describe("history storage", () => {
  it("keys the cache by network, executor, and account, lower-cased", () => {
    expect(historyKey(networks.testnet, "0xB36B2E012003840951CFf00fA6b1E3237A110920", ME)).toBe(
      "mezoroute.testnet.history.0xb36b2e012003840951cff00fa6b1e3237a110920.0xd74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    );
  });

  it("round-trips bigints and rejects anything that is not a cache", () => {
    const cache = { scannedTo: 950n, events: [entered(900n, 3)] };
    expect(parseHistory(serializeHistory(cache))).toEqual(cache);
    expect(parseHistory(null)).toBeNull();
    expect(parseHistory("not json")).toBeNull();
    expect(parseHistory('{"scannedTo":1,"events":[]}')).toBeNull();
  });
});
```

Create `web/src/lib/positions/history-reader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readExecutorEvents, type LogsClient } from "./history-reader";

const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

describe("readExecutorEvents", () => {
  it("asks for Entered by recipient and Exited by caller, and tags each log", async () => {
    const calls: { event: string; args: unknown; fromBlock: unknown; toBlock: unknown }[] = [];
    const client = {
      getLogs: async (request: { event: { name: string }; args: unknown; fromBlock: bigint; toBlock: bigint }) => {
        calls.push({ event: request.event.name, args: request.args, fromBlock: request.fromBlock, toBlock: request.toBlock });
        return request.event.name === "Entered"
          ? [{ blockNumber: 7n, logIndex: 2, args: { liquidityOut: 1n } }]
          : [{ blockNumber: 9n, logIndex: 0, args: { liquidityIn: 1n } }];
      },
    } as unknown as LogsClient;

    const events = await readExecutorEvents(client, EXECUTOR, ME, { fromBlock: 1n, toBlock: 10n });
    expect(calls).toEqual([
      { event: "Entered", args: { recipient: ME }, fromBlock: 1n, toBlock: 10n },
      { event: "Exited", args: { caller: ME }, fromBlock: 1n, toBlock: 10n },
    ]);
    expect(events).toEqual([
      { kind: "entered", blockNumber: 7n, logIndex: 2, event: { liquidityOut: 1n } },
      { kind: "exited", blockNumber: 9n, logIndex: 0, event: { liquidityIn: 1n } },
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/positions/history.test.ts src/lib/positions/history-reader.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

Append to `web/src/lib/routes/musd-btc-lp/receipt.ts` (after `EnteredEvent`):

```ts
export type ExitedEvent = {
  caller: Address;
  recipient: Address;
  liquidityIn: bigint;
  musdRemoved: bigint;
  btcRemoved: bigint;
  musdFromSwap: bigint;
  musdOut: bigint;
  btcRefund: bigint;
};
```

Create `web/src/lib/positions/history.ts`:

```ts
import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";

/** Mezo's public RPC serves eth_getLogs over at most 10,000 blocks. */
export const LOG_RANGE = 10_000n;
/** Events this close to the head are re-read every time, so a re-org cannot leave them in the cache. */
export const REORG_MARGIN = 50n;
export const SCAN_CONCURRENCY = 6;
const ATTEMPTS = 3;

export type BlockRange = { fromBlock: bigint; toBlock: bigint };
export type HistoryEvent =
  | { kind: "entered"; blockNumber: bigint; logIndex: number; event: EnteredEvent }
  | { kind: "exited"; blockNumber: bigint; logIndex: number; event: ExitedEvent };
/** Every event up to `scannedTo`; the scan resumes after it. */
export type HistoryCache = { scannedTo: bigint; events: HistoryEvent[] };
export type ReadChunk = (range: BlockRange) => Promise<HistoryEvent[]>;

/** Ranges of `size` blocks from `from` to `head`; the last ends at the head, never past it. */
export function scanRanges(from: bigint, head: bigint, size: bigint = LOG_RANGE): BlockRange[] {
  const ranges: BlockRange[] = [];
  for (let start = from; start <= head; start += size) {
    const end = start + size - 1n;
    ranges.push({ fromBlock: start, toBlock: end < head ? end : head });
  }
  return ranges;
}

function sortEvents(events: HistoryEvent[]): HistoryEvent[] {
  return [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );
}

async function withAttempts<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
    }
  }
}

/** Reads every range, `concurrency` at a time, each with three attempts; one failed range fails the whole read. */
export async function readRanges(
  read: ReadChunk,
  ranges: BlockRange[],
  concurrency: number = SCAN_CONCURRENCY,
): Promise<HistoryEvent[]> {
  const results: HistoryEvent[][] = [];
  let next = 0;
  async function worker() {
    while (next < ranges.length) {
      const index = next;
      next += 1;
      results[index] = await withAttempts(() => read(ranges[index]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ranges.length) }, worker));
  return sortEvents(results.flat());
}

function scanStart(cache: HistoryCache | null, deployBlock: bigint): bigint {
  return cache ? cache.scannedTo + 1n : deployBlock;
}

/** All events (cached + fresh), and the next cache: only events at least REORG_MARGIN blocks deep. */
export function mergeHistory(
  cache: HistoryCache | null,
  fresh: HistoryEvent[],
  head: bigint,
  deployBlock: bigint,
): { events: HistoryEvent[]; cache: HistoryCache | null } {
  const events = sortEvents([...(cache?.events ?? []), ...fresh]);
  const safeTo = head - REORG_MARGIN;
  if (safeTo < scanStart(cache, deployBlock)) return { events, cache };
  return { events, cache: { scannedTo: safeTo, events: events.filter((item) => item.blockNumber <= safeTo) } };
}

/** Reads what the cache does not cover, up to the head. Rejects (and so caches nothing) if a range fails. */
export async function loadHistory(input: {
  read: ReadChunk;
  head: bigint;
  deployBlock: bigint;
  cache: HistoryCache | null;
}): Promise<{ events: HistoryEvent[]; cache: HistoryCache | null }> {
  const from = scanStart(input.cache, input.deployBlock);
  const fresh = from > input.head ? [] : await readRanges(input.read, scanRanges(from, input.head));
  return mergeHistory(input.cache, fresh, input.head, input.deployBlock);
}

/** One cache per network, executor, and account (spec §12: a convenience only). */
export function historyKey(network: NetworkConfig, executor: Address, account: Address): string {
  return `mezoroute.${network.id}.history.${executor.toLowerCase()}.${account.toLowerCase()}`;
}

export function serializeHistory(cache: HistoryCache): string {
  return JSON.stringify(cache, (_key, value: unknown) => (typeof value === "bigint" ? { $bigint: value.toString() } : value));
}

/** The stored cache, or null when absent or not a cache (any parse problem means a fresh scan). */
export function parseHistory(text: string | null): HistoryCache | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text, (_key, value: unknown) =>
      value !== null && typeof value === "object" && typeof (value as { $bigint?: unknown }).$bigint === "string"
        ? BigInt((value as { $bigint: string }).$bigint)
        : value,
    );
    const cache = parsed as Partial<HistoryCache> | null;
    return cache && typeof cache.scannedTo === "bigint" && Array.isArray(cache.events) ? (cache as HistoryCache) : null;
  } catch {
    return null;
  }
}
```

Create `web/src/lib/positions/history-reader.ts`:

```ts
import { getAbiItem, type Address, type PublicClient } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";
import type { BlockRange, HistoryEvent } from "./history";

export type LogsClient = { getLogs: PublicClient["getLogs"] };

const ENTERED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Entered" });
const EXITED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Exited" });

/**
 * The account's executor events in one range: LP minted to it (`Entered` by recipient) and LP pulled
 * from it (`Exited` by caller), both filtered by indexed topics on the node.
 */
export async function readExecutorEvents(
  client: LogsClient,
  executor: Address,
  account: Address,
  range: BlockRange,
): Promise<HistoryEvent[]> {
  const [entered, exited] = await Promise.all([
    client.getLogs({ address: executor, event: ENTERED, args: { recipient: account }, ...range }),
    client.getLogs({ address: executor, event: EXITED, args: { caller: account }, ...range }),
  ]);
  return [
    ...entered.map((log) => ({
      kind: "entered" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as EnteredEvent,
    })),
    ...exited.map((log) => ({
      kind: "exited" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as ExitedEvent,
    })),
  ];
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/positions/history.test.ts src/lib/positions/history-reader.test.ts && npx tsc --noEmit`
Expected: PASS (12 tests), no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/routes/musd-btc-lp/receipt.ts web/src/lib/positions/history.ts web/src/lib/positions/history.test.ts web/src/lib/positions/history-reader.ts web/src/lib/positions/history-reader.test.ts
git commit -m "feat(web): scan the executor's entry and exit events in head-clamped chunks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cost basis and the position view

**Files:**
- Create: `web/src/lib/positions/cost-basis.ts`, `web/src/lib/positions/view.ts`
- Test: `web/src/lib/positions/cost-basis.test.ts`, `web/src/lib/positions/view.test.ts`

**Interfaces:**
- Consumes: `HistoryEvent` (Task 3); `PositionsSnapshot`, fixtures (Task 2); `quoteExit`, `ExitQuote` (Task 1); `WAD`.
- Produces:
  - `type CostBasis = { attributedLp: bigint; basis: bigint; coveredLp: bigint; coveredBasis: bigint; coveredFees: bigint; unattributedLp: bigint }`
  - `costBasis(events: HistoryEvent[], lpBalance: bigint): CostBasis`
  - `type LpView = { balance: bigint; share: bigint; musd: bigint; btc: bigint; btcValue: bigint; value: bigint; exit: ExitQuote | null; cost: CostBasis | null; valueChange: bigint | null }`
  - `type FeesView = { musd: bigint; btc: bigint; btcValue: bigint; total: bigint }`
  - `type PositionView = { lp: LpView; fees: FeesView; empty: boolean }`
  - `positionView(snapshot: PositionsSnapshot, events: HistoryEvent[] | null): PositionView`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/positions/cost-basis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";
import { costBasis } from "./cost-basis";
import type { HistoryEvent } from "./history";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const ONE = 10n ** 18n;

function entered(overrides: Partial<EnteredEvent> = {}, blockNumber = 1n): HistoryEvent {
  return {
    kind: "entered",
    blockNumber,
    logIndex: 0,
    event: {
      caller: ME,
      recipient: ME,
      musdBorrowed: 0n,
      musdIn: 100n * ONE,
      fee: ONE / 10n,
      musdSwapped: 50n * ONE,
      btcFromSwap: 1_000n,
      musdAdded: 49n * ONE,
      btcAdded: 1_000n,
      liquidityOut: 1_000n,
      musdRefund: 0n,
      btcRefund: 0n,
      ...overrides,
    },
  };
}

function exited(liquidityIn: bigint, blockNumber = 2n): HistoryEvent {
  const event: ExitedEvent = {
    caller: ME,
    recipient: ME,
    liquidityIn,
    musdRemoved: 0n,
    btcRemoved: 0n,
    musdFromSwap: 0n,
    musdOut: 0n,
    btcRefund: 0n,
  };
  return { kind: "exited", blockNumber, logIndex: 0, event };
}

describe("costBasis", () => {
  it("is MUSD in minus refunds, with the MezoRoute fee inside it", () => {
    expect(costBasis([entered({ musdRefund: 2n * ONE })], 1_000n)).toEqual({
      attributedLp: 1_000n,
      basis: 98n * ONE,
      coveredLp: 1_000n,
      coveredBasis: 98n * ONE,
      coveredFees: ONE / 10n,
      unattributedLp: 0n,
    });
  });

  it("values a BTC refund at the entry's swap price", () => {
    // 10 wei BTC at 50 MUSD per 1,000 wei = 0.5 MUSD
    expect(costBasis([entered({ btcRefund: 10n })], 1_000n).basis).toBe(99n * ONE + ONE / 2n);
  });

  it("removes cost pro rata by LP on a partial exit, and all of it on a full exit", () => {
    expect(costBasis([entered(), exited(250n)], 750n)).toMatchObject({
      attributedLp: 750n,
      basis: 75n * ONE,
      coveredFees: (ONE / 10n) * 3n / 4n,
    });
    expect(costBasis([entered(), exited(1_000n)], 0n)).toMatchObject({ attributedLp: 0n, basis: 0n, coveredBasis: 0n });
  });

  it("never goes below zero when more LP exits than MezoRoute entered", () => {
    expect(costBasis([entered(), exited(5_000n)], 0n)).toMatchObject({ attributedLp: 0n, basis: 0n });
  });

  it("leaves LP from elsewhere without a cost basis", () => {
    expect(costBasis([entered()], 1_500n)).toMatchObject({ coveredLp: 1_000n, coveredBasis: 100n * ONE, unattributedLp: 500n });
    expect(costBasis([], 1_500n)).toMatchObject({ coveredLp: 0n, coveredBasis: 0n, unattributedLp: 1_500n });
  });

  it("scales the basis down when the wallet holds less LP than MezoRoute entered", () => {
    expect(costBasis([entered()], 400n)).toMatchObject({ coveredLp: 400n, coveredBasis: 40n * ONE, unattributedLp: 0n });
  });
});
```

Create `web/src/lib/positions/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import type { HistoryEvent } from "./history";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL, ONE, positionsSnapshotWith } from "./test-fixtures";
import { positionView } from "./view";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const entry: HistoryEvent = {
  kind: "entered",
  blockNumber: 1n,
  logIndex: 0,
  event: {
    caller: ME,
    recipient: ME,
    musdBorrowed: 0n,
    musdIn: 40n * ONE,
    fee: 4n * ONE / 100n,
    musdSwapped: 20n * ONE,
    btcFromSwap: 253582349184825n,
    musdAdded: 20n * ONE,
    btcAdded: 253582349184825n,
    liquidityOut: LIVE_EXIT_LIQUIDITY,
    musdRefund: 0n,
    btcRefund: 0n,
  } satisfies EnteredEvent,
};

describe("positionView", () => {
  const snapshot = positionsSnapshotWith({ lpBalance: LIVE_EXIT_LIQUIDITY, fees: { musd: 5n * ONE, btc: ONE / 1_000n } });

  it("shows the underlying, the full-exit value, and the change against the cost basis", () => {
    const view = positionView(snapshot, [entry]);
    expect(view.lp.musd).toBe(19972003253167101669n);
    expect(view.lp.btc).toBe(253582349184825n);
    expect(view.lp.share).toBe((LIVE_EXIT_LIQUIDITY * ONE) / LIVE_EXIT_POOL.totalSupply);
    expect(view.lp.exit?.musdOut).toBe(39936013820348314126n);
    // 39.936… MUSD out against 40 MUSD in
    expect(view.lp.valueChange).toBe(39936013820348314126n - 40n * ONE);
    expect(view.empty).toBe(false);
  });

  it("values fees at the snapshot price", () => {
    const view = positionView(snapshot, null);
    expect(view.fees).toEqual({
      musd: 5n * ONE,
      btc: ONE / 1_000n,
      btcValue: (snapshot.price * (ONE / 1_000n)) / ONE,
      total: 5n * ONE + (snapshot.price * (ONE / 1_000n)) / ONE,
    });
  });

  it("has no cost or change while the history is loading or without MezoRoute entries", () => {
    expect(positionView(snapshot, null).lp).toMatchObject({ cost: null, valueChange: null });
    expect(positionView(snapshot, []).lp.valueChange).toBeNull();
  });

  it("is empty with no LP and no fees", () => {
    const view = positionView(positionsSnapshotWith({ lpBalance: 0n }), []);
    expect(view.empty).toBe(true);
    expect(view.lp.exit).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/positions/cost-basis.test.ts src/lib/positions/view.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

Create `web/src/lib/positions/cost-basis.ts`:

```ts
import type { HistoryEvent } from "./history";

/**
 * MUSD cost of the LP MezoRoute put in the wallet (spec §12 "Cost basis"): entries add
 * `musdIn − musdRefund − btcRefund at the entry's swap price` (the execution fee is inside it), exits
 * remove cost pro rata by LP. "Covered" is the part of the current balance that has a cost basis.
 */
export type CostBasis = {
  attributedLp: bigint; // LP entered through MezoRoute minus LP exited through it
  basis: bigint; // MUSD cost of attributedLp
  coveredLp: bigint; // min(balance, attributedLp)
  coveredBasis: bigint;
  coveredFees: bigint; // MezoRoute fees inside coveredBasis
  unattributedLp: bigint; // LP from elsewhere: no cost basis
};

export function costBasis(events: HistoryEvent[], lpBalance: bigint): CostBasis {
  let lp = 0n;
  let basis = 0n;
  let fees = 0n;
  for (const item of events) {
    if (item.kind === "entered") {
      const entry = item.event;
      const btcRefundValue = entry.btcFromSwap > 0n ? (entry.btcRefund * entry.musdSwapped) / entry.btcFromSwap : 0n;
      lp += entry.liquidityOut;
      basis += entry.musdIn - entry.musdRefund - btcRefundValue;
      fees += entry.fee;
    } else if (lp > 0n) {
      const removed = item.event.liquidityIn < lp ? item.event.liquidityIn : lp;
      basis -= (basis * removed) / lp;
      fees -= (fees * removed) / lp;
      lp -= removed;
    }
  }
  const coveredLp = lpBalance < lp ? lpBalance : lp;
  const share = (value: bigint) => (lp === 0n ? 0n : (value * coveredLp) / lp);
  return {
    attributedLp: lp,
    basis,
    coveredLp,
    coveredBasis: share(basis),
    coveredFees: share(fees),
    unattributedLp: lpBalance - coveredLp,
  };
}
```

Create `web/src/lib/positions/view.ts`:

```ts
import { WAD } from "@/lib/math";
import { quoteExit, type ExitQuote } from "@/lib/quote/exit";
import { costBasis, type CostBasis } from "./cost-basis";
import type { HistoryEvent } from "./history";
import type { PositionsSnapshot } from "./snapshot";

export type LpView = {
  balance: bigint;
  share: bigint; // of the pool, 1e18 = 100%
  musd: bigint; // what burn would pay now
  btc: bigint;
  btcValue: bigint; // btc at the price feed
  value: bigint; // musd + btcValue
  exit: ExitQuote | null; // exiting everything now, before slippage
  cost: CostBasis | null; // null while the history loads or fails
  valueChange: bigint | null; // exit value of the covered LP − its cost; null without covered LP
};
export type FeesView = { musd: bigint; btc: bigint; btcValue: bigint; total: bigint };
export type PositionView = { lp: LpView; fees: FeesView; empty: boolean };

/** Positions screen values (spec Flow F) from one snapshot and, once loaded, the event history. */
export function positionView(snapshot: PositionsSnapshot, events: HistoryEvent[] | null): PositionView {
  const { pool, lpBalance: balance, price } = snapshot;
  const supply = pool.totalSupply;
  const musd = supply === 0n ? 0n : (balance * pool.balanceMusd) / supply;
  const btc = supply === 0n ? 0n : (balance * pool.balanceBtc) / supply;
  const btcValue = (btc * price) / WAD;
  const exit = balance > 0n ? quoteExit(pool, balance) : null;
  const cost = events ? costBasis(events, balance) : null;
  const valueChange =
    cost && exit && cost.coveredLp > 0n ? (exit.musdOut * cost.coveredLp) / balance - cost.coveredBasis : null;
  const feesBtcValue = (snapshot.fees.btc * price) / WAD;
  return {
    lp: {
      balance,
      share: supply === 0n ? 0n : (balance * WAD) / supply,
      musd,
      btc,
      btcValue,
      value: musd + btcValue,
      exit,
      cost,
      valueChange,
    },
    fees: { ...snapshot.fees, btcValue: feesBtcValue, total: snapshot.fees.musd + feesBtcValue },
    empty: balance === 0n && snapshot.fees.musd === 0n && snapshot.fees.btc === 0n,
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib/positions`
Expected: PASS (all positions tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/positions/cost-basis.ts web/src/lib/positions/cost-basis.test.ts web/src/lib/positions/view.ts web/src/lib/positions/view.test.ts
git commit -m "feat(web): compute the LP cost basis and the estimated position value change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Exit intent, outcomes, gates, steps, params, preview; generic stepper

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/intent.ts`, `web/src/lib/errors/types.ts`, `web/src/lib/errors/outcomes.ts`, `web/src/lib/tx/stepper.ts`, `web/src/lib/routes/musd-btc-lp/useEntryFlow.ts`, `web/src/components/lp/BlockNotice.tsx`
- Create: `web/src/lib/positions/exit-intent.ts`, `web/src/lib/positions/exit-gate.ts`, `web/src/lib/positions/exit-steps.ts`, `web/src/lib/positions/exit-params.ts`, `web/src/lib/positions/exit-preview.ts`, `web/src/lib/positions/claim.ts`
- Test: `web/src/lib/positions/exit-intent.test.ts`, `web/src/lib/positions/exit-gate.test.ts`, `web/src/lib/positions/exit-steps.test.ts`, `web/src/lib/positions/exit-params.test.ts`, `web/src/lib/positions/exit-preview.test.ts`, `web/src/lib/positions/claim.test.ts`, `web/src/lib/tx/stepper.test.ts` (one added case)

**Interfaces:**
- Consumes: Tasks 1–2; `writeBlocker`; `PRICE_IMPACT_LIMIT`, `QUOTE_TTL_MS` from `@/lib/routes/musd-btc-lp/gate`; `needsApproval`, `NO_PERMIT`, `DEADLINE_SECONDS`, `ExecutorPermit` from `.../params`; `walletCapabilities`; `lacksGas`.
- Produces:
  - `parseSlippage(param: string | null): SlippageBps`, `slippageParam(bps: SlippageBps): string` (from F3 `intent.ts`)
  - `EXIT_PERCENTS = [25, 50, 75, 100] as const`, `type ExitPercent`, `type ExitIntent = { percent: ExitPercent; slippageBps: SlippageBps }`, `DEFAULT_EXIT_INTENT`, `parseExitIntent(params)`, `exitQuery(intent)`, `exitLiquidity(balance, percent)`
  - Outcomes `NO_LP`, `LP_CHANGED`, `NOTHING_TO_CLAIM` (kinds `"no-lp" | "lp-changed" | "nothing-to-claim"`)
  - `type ExitBlockReason`, `type ExitBlock = { reason: ExitBlockReason; outcome: Outcome | null }`, `type ExitGateInput`, `exitBlock(input)`
  - `type ExitStepKind = "permit" | "approve" | "exit"`, `exitSteps(kind, allowance, liquidityIn)`
  - `type ExitParams`, `buildExitParams(quote, minimums, deadline, recipient)`, `encodeExitCall(params, permit?)`
  - `type ExitPreview = { liquidityIn; quote: ExitQuote | null; minimums: ExitMinimums | null; steps: ExitStepKind[]; gasUnits: bigint; gasCost: bigint | null; deadline: bigint; block: ExitBlock | null }`, `exitPreview({ network, data, intent, liquidityIn?, walletKind, walletChainId, now })`
  - `type ClaimBlock = { reason: "no-executor" | "wrong-network" | "nothing-to-claim" | "needs-gas"; outcome: Outcome }`, `claimBlock({ network, walletChainId, fees, lacksGas })`
  - Stepper generic: `Step<K extends string = StepKind>`, `Stepper<K>`, `StepperEvent<K>`, `createStepper<K>`, `stepperReducer<K>`; `BlockNotice` takes `{ block: { outcome: Outcome | null } | null }`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/positions/exit-intent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exitLiquidity, exitQuery, parseExitIntent } from "./exit-intent";

const params = (query: string) => new URLSearchParams(query);

describe("parseExitIntent and exitQuery", () => {
  it("round-trips the percent and the slippage", () => {
    expect(parseExitIntent(params("percent=50&slippage=0.5"))).toEqual({ percent: 50, slippageBps: 50n });
    expect(exitQuery({ percent: 50, slippageBps: 50n })).toBe("?percent=50&slippage=0.5");
  });

  it("defaults to Max and 1% for anything else", () => {
    expect(parseExitIntent(params("percent=33&slippage=9"))).toEqual({ percent: 100, slippageBps: 100n });
    expect(parseExitIntent(params(""))).toEqual({ percent: 100, slippageBps: 100n });
  });
});

describe("exitLiquidity", () => {
  it("is the exact balance at Max, so no dust stays behind", () => {
    expect(exitLiquidity(1_000_000_000_000_000_007n, 100)).toBe(1_000_000_000_000_000_007n);
  });

  it("rounds a share down", () => {
    expect(exitLiquidity(1_003n, 25)).toBe(250n);
    expect(exitLiquidity(1_003n, 75)).toBe(752n);
  });
});
```

Create `web/src/lib/positions/exit-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { quoteExit } from "@/lib/quote/exit";
import { PRICE_IMPACT_LIMIT, QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import { exitBlock, type ExitGateInput } from "./exit-gate";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL } from "./test-fixtures";

const testnet = networks.testnet;
const QUOTE = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_LIQUIDITY);

function input(overrides: Partial<ExitGateInput> = {}): ExitGateInput {
  return {
    network: testnet,
    walletChainId: testnet.chainId,
    lpBalance: LIVE_EXIT_LIQUIDITY,
    liquidityIn: LIVE_EXIT_LIQUIDITY,
    quote: QUOTE,
    lacksGas: false,
    quoteAgeMs: 0,
    ...overrides,
  };
}

describe("exitBlock", () => {
  it("lets a valid exit through", () => {
    expect(exitBlock(input())).toBeNull();
  });

  it("blocks in order: no executor, wrong network, no LP, LP changed, too small, impact, gas, stale quote", () => {
    expect(exitBlock(input({ network: networks.mainnet, walletChainId: 1, lpBalance: 0n }))?.reason).toBe("no-executor");
    expect(exitBlock(input({ walletChainId: 1, lpBalance: 0n }))?.reason).toBe("wrong-network");
    expect(exitBlock(input({ lpBalance: 0n, quote: null }))).toMatchObject({
      reason: "no-lp",
      outcome: { message: "You have no MUSD/BTC LP to exit." },
    });
    expect(exitBlock(input({ lpBalance: LIVE_EXIT_LIQUIDITY - 1n, quote: null }))).toMatchObject({
      reason: "lp-changed",
      outcome: { message: "Your LP balance changed. Review the exit again." },
    });
    expect(exitBlock(input({ quote: null, lacksGas: true }))?.reason).toBe("too-small");
    const big = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_POOL.totalSupply / 4n);
    expect(exitBlock(input({ lpBalance: LIVE_EXIT_POOL.totalSupply, liquidityIn: LIVE_EXIT_POOL.totalSupply / 4n, quote: big, lacksGas: true }))?.reason).toBe(
      "price-impact",
    );
    expect(exitBlock(input({ lacksGas: true, quoteAgeMs: QUOTE_TTL_MS + 1 }))?.reason).toBe("needs-gas");
    expect(exitBlock(input({ quoteAgeMs: QUOTE_TTL_MS + 1 }))?.reason).toBe("quote-expired");
  });

  it("allows price impact exactly at the limit and a quote exactly 60 s old", () => {
    expect(exitBlock(input({ quote: { ...QUOTE!, priceImpact: PRICE_IMPACT_LIMIT }, quoteAgeMs: QUOTE_TTL_MS }))).toBeNull();
  });
});
```

Create `web/src/lib/positions/exit-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exitSteps } from "./exit-steps";

describe("exitSteps", () => {
  it("asks an EOA for an LP permit and a smart account for an exact approval", () => {
    expect(exitSteps("eoa", 0n, 10n)).toEqual(["permit", "exit"]);
    expect(exitSteps("smart-account", 0n, 10n)).toEqual(["approve", "exit"]);
    expect(exitSteps("unknown", 9n, 10n)).toEqual(["approve", "exit"]);
  });

  it("skips the first step when the allowance covers the LP", () => {
    expect(exitSteps("eoa", 10n, 10n)).toEqual(["exit"]);
    expect(exitSteps("smart-account", 11n, 10n)).toEqual(["exit"]);
  });
});
```

Create `web/src/lib/positions/exit-params.test.ts`:

```ts
import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { exitMinimums, quoteExit } from "@/lib/quote/exit";
import { NO_PERMIT } from "@/lib/routes/musd-btc-lp/params";
import { buildExitParams, encodeExitCall } from "./exit-params";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL } from "./test-fixtures";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49" as const;

describe("buildExitParams and encodeExitCall", () => {
  it("encodes exit(params, permit) with the quote's LP and minimums for the caller", () => {
    const quote = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_LIQUIDITY)!;
    const params = buildExitParams(quote, exitMinimums(quote, 100n), 1_790_904_300n, ME);
    expect(params).toEqual({
      liquidityIn: LIVE_EXIT_LIQUIDITY,
      minMusdRemoved: 19772283220635430652n,
      minBtcRemoved: 251046525692976n,
      minMusdFromSwap: 19764370461509400332n,
      minMusdOut: 39536653682144830984n,
      deadline: 1_790_904_300n,
      recipient: ME,
    });
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeExitCall(params) });
    expect(decoded.functionName).toBe("exit");
    expect(decoded.args).toEqual([params, NO_PERMIT]);
  });
});
```

Create `web/src/lib/positions/exit-preview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { exitPreview } from "./exit-preview";
import { LIVE_EXIT_LIQUIDITY, positionsDataWith, positionsSnapshotWith } from "./test-fixtures";

const testnet = networks.testnet;
const base = { network: testnet, walletChainId: testnet.chainId, now: 1_000_000 };

describe("exitPreview", () => {
  it("quotes the chosen share for an EOA: permit then exit, deadline 10 minutes after the block", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith(), intent: { percent: 50, slippageBps: 100n }, walletKind: "eoa" });
    expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY);
    expect(preview.quote?.musdOut).toBe(39936013820348314126n);
    expect(preview.minimums?.minMusdOut).toBe(39536653682144830984n);
    expect(preview.steps).toEqual(["permit", "exit"]);
    expect(preview.gasUnits).toBe(400_000n);
    expect(preview.gasCost).toBe(400_000n * 146n);
    expect(preview.deadline).toBe(1_790_903_700n + 600n);
    expect(preview.block).toBeNull();
  });

  it("uses a pinned liquidityIn instead of the percent, and blocks when it exceeds the balance", () => {
    const data = positionsDataWith({ snapshot: positionsSnapshotWith({ lpBalance: LIVE_EXIT_LIQUIDITY }) });
    const preview = exitPreview({ ...base, data, intent: { percent: 100, slippageBps: 100n }, liquidityIn: LIVE_EXIT_LIQUIDITY + 1n, walletKind: "eoa" });
    expect(preview.liquidityIn).toBe(LIVE_EXIT_LIQUIDITY + 1n);
    expect(preview.block?.reason).toBe("lp-changed");
  });

  it("adds the approval and relayer gas for a smart account", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith(), intent: { percent: 100, slippageBps: 100n }, walletKind: "smart-account" });
    expect(preview.steps).toEqual(["approve", "exit"]);
    expect(preview.gasUnits).toBe(400_000n + 60_000n + 2n * 197_471n);
  });

  it("has no gas cost when the gas price failed to load", () => {
    const preview = exitPreview({ ...base, data: positionsDataWith({ gasPrice: undefined }), intent: { percent: 100, slippageBps: 100n }, walletKind: "eoa" });
    expect(preview.gasCost).toBeNull();
  });
});
```

Create `web/src/lib/positions/claim.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { claimBlock } from "./claim";

const testnet = networks.testnet;
const fees = { musd: 1n, btc: 0n };

describe("claimBlock", () => {
  it("lets a claim through with fees, the right network, and gas", () => {
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: false })).toBeNull();
  });

  it("blocks in order: no executor (mainnet read-only), wrong network, nothing to claim, gas", () => {
    expect(claimBlock({ network: networks.mainnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("no-executor");
    expect(claimBlock({ network: testnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("wrong-network");
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees: { musd: 0n, btc: 0n }, lacksGas: true })).toMatchObject({
      reason: "nothing-to-claim",
      outcome: { message: "You have no fees to claim yet." },
    });
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: true })?.reason).toBe("needs-gas");
  });
});
```

Add to `web/src/lib/tx/stepper.test.ts` (inside its top-level `describe`, using its existing imports):

```ts
  it("runs any step kinds, such as the exit flow's", () => {
    let state = createStepper<"permit" | "exit">(["permit", "exit"]);
    state = stepperReducer(state, { type: "start" });
    state = stepperReducer(state, { type: "signed" });
    expect(state.active).toBe(1);
    expect(state.steps[0]).toEqual({ kind: "permit", status: "done" });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/positions src/lib/tx/stepper.test.ts`
Expected: FAIL (exit-* and claim modules missing; `createStepper<…>` with a non-`StepKind` list fails type-wise only under tsc — the vitest run fails on the missing modules).

- [ ] **Step 3: Implement**

In `web/src/lib/routes/musd-btc-lp/intent.ts`, add and use the slippage helpers:

```ts
/** A slippage preset from its URL value; anything else is the default (never raised silently). */
export function parseSlippage(param: string | null): SlippageBps {
  return param !== null && Object.hasOwn(SLIPPAGE_BY_PARAM, param) ? SLIPPAGE_BY_PARAM[param] : DEFAULT_SLIPPAGE;
}

export function slippageParam(bps: SlippageBps): string {
  return PARAM_BY_SLIPPAGE[bps.toString()];
}
```

In `parseEntryIntent` replace the `slippage` local and its ternary with `slippageBps: parseSlippage(params.get("slippage")),`; in `entryQuery` use `query.set("slippage", slippageParam(intent.slippageBps));`.

In `web/src/lib/errors/types.ts` add to `ErrorKind` (before `"reverted"`):

```ts
  | "no-lp"
  | "lp-changed"
  | "nothing-to-claim"
```

In `web/src/lib/errors/outcomes.ts` add (before `REVERTED`):

```ts
export const NO_LP: Outcome = { kind: "no-lp", message: "You have no MUSD/BTC LP to exit.", recovery: [] };

export const LP_CHANGED: Outcome = {
  kind: "lp-changed",
  message: "Your LP balance changed. Review the exit again.",
  recovery: [],
};

export const NOTHING_TO_CLAIM: Outcome = { kind: "nothing-to-claim", message: "You have no fees to claim yet.", recovery: [] };
```

Replace `web/src/lib/tx/stepper.ts` with the generic version (behaviour unchanged):

```ts
import type { Hash } from "viem";
import type { DecodedError } from "@/lib/errors/types";
import type { StepKind } from "@/lib/routes/musd-btc-lp/steps";

export type StepStatus = "idle" | "awaiting-wallet" | "submitted" | "done" | "failed";
export type Step<K extends string = StepKind> = { kind: K; status: StepStatus; hash?: Hash; error?: DecodedError };
/** `active` is the index of the step the user acts on next; it equals `steps.length` when all are done. */
export type Stepper<K extends string = StepKind> = { steps: Step<K>[]; active: number };

export type StepperEvent<K extends string = StepKind> =
  | { type: "start" }
  | { type: "signed" }
  | { type: "submitted"; hash: Hash }
  | { type: "confirmed" }
  | { type: "failed"; error: DecodedError }
  | { type: "signature-expired" }
  | { type: "reset"; kinds: K[] };

export function createStepper<K extends string = StepKind>(kinds: K[]): Stepper<K> {
  return { steps: kinds.map((kind) => ({ kind, status: "idle" })), active: 0 };
}

export function hasStarted(state: Stepper<string>): boolean {
  return state.steps.some((step) => step.status !== "idle");
}

/** Steps the user signs without a transaction. */
function isSignature(kind: string): boolean {
  return kind === "permit" || kind === "borrow";
}

/** The entry and exit steppers (spec §9 screens 3a, 6a); events that do not fit the active step are ignored. */
export function stepperReducer<K extends string = StepKind>(state: Stepper<K>, event: StepperEvent<K>): Stepper<K> {
  const step = state.steps[state.active];
  const replace = (next: Step<K>, advance = false): Stepper<K> => ({
    steps: state.steps.map((current, index) => (index === state.active ? next : current)),
    active: advance ? state.active + 1 : state.active,
  });

  switch (event.type) {
    case "reset":
      return hasStarted(state) ? state : createStepper(event.kinds);
    case "signature-expired": {
      const first = state.steps.findIndex((current) => isSignature(current.kind));
      if (first === -1) return state;
      return {
        steps: state.steps.map((current, index) => (index >= first ? { kind: current.kind, status: "idle" } : current)),
        active: first,
      };
    }
    case "start":
      return step && (step.status === "idle" || step.status === "failed")
        ? replace({ kind: step.kind, status: "awaiting-wallet" })
        : state;
    case "signed":
      return step && isSignature(step.kind) && step.status === "awaiting-wallet" ? replace({ ...step, status: "done" }, true) : state;
    case "submitted":
      return step && !isSignature(step.kind) && step.status === "awaiting-wallet"
        ? replace({ ...step, status: "submitted", hash: event.hash })
        : state;
    case "confirmed":
      return step?.status === "submitted" ? replace({ ...step, status: "done" }, true) : state;
    case "failed":
      return step && (step.status === "awaiting-wallet" || step.status === "submitted")
        ? replace({ ...step, status: "failed", error: event.error })
        : state;
  }
}
```

In `web/src/lib/routes/musd-btc-lp/useEntryFlow.ts`, pin the kind type in the reducer call:

```ts
  const [stepper, dispatch] = useReducer(stepperReducer<StepKind>, input.plan, createStepper<StepKind>);
```

In `web/src/components/lp/BlockNotice.tsx`, widen the prop:

```tsx
import type { Outcome } from "@/lib/errors/types";

/** Why the primary action is disabled, in the §13 wording; nothing when there is no message. */
export function BlockNotice({ block }: { block: { outcome: Outcome | null } | null }) {
```

Create `web/src/lib/positions/exit-intent.ts`:

```ts
import { DEFAULT_SLIPPAGE, type SlippageBps } from "@/lib/quote/entry";
import { parseSlippage, slippageParam } from "@/lib/routes/musd-btc-lp/intent";

export const EXIT_PERCENTS = [25, 50, 75, 100] as const;
export type ExitPercent = (typeof EXIT_PERCENTS)[number];

/** What the user asked for on the exit page; the only state in its URL. */
export type ExitIntent = { percent: ExitPercent; slippageBps: SlippageBps };
export const DEFAULT_EXIT_INTENT: ExitIntent = { percent: 100, slippageBps: DEFAULT_SLIPPAGE };

export function parseExitIntent(params: { get(name: string): string | null }): ExitIntent {
  const percent = Number(params.get("percent"));
  return {
    percent: EXIT_PERCENTS.find((value) => value === percent) ?? 100,
    slippageBps: parseSlippage(params.get("slippage")),
  };
}

export function exitQuery(intent: ExitIntent): string {
  return `?${new URLSearchParams({ percent: intent.percent.toString(), slippage: slippageParam(intent.slippageBps) }).toString()}`;
}

/** LP to exit: the exact balance at Max (no dust left behind), otherwise the share rounded down. */
export function exitLiquidity(balance: bigint, percent: ExitPercent): bigint {
  return percent === 100 ? balance : (balance * BigInt(percent)) / 100n;
}
```

Create `web/src/lib/positions/exit-gate.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { AMOUNT_TOO_SMALL, LP_CHANGED, needsGas, NO_LP, noExecutor, PRICE_IMPACT, QUOTE_EXPIRED, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { ExitQuote } from "@/lib/quote/exit";
import { PRICE_IMPACT_LIMIT, QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";

export type ExitBlockReason =
  | "no-executor"
  | "wrong-network"
  | "no-lp"
  | "lp-changed"
  | "too-small"
  | "price-impact"
  | "needs-gas"
  | "quote-expired";
export type ExitBlock = { reason: ExitBlockReason; outcome: Outcome | null };

export type ExitGateInput = {
  network: NetworkConfig;
  walletChainId: number | undefined;
  lpBalance: bigint;
  liquidityIn: bigint;
  quote: ExitQuote | null;
  lacksGas: boolean;
  quoteAgeMs: number;
};

/** Why exit is blocked; the first matching reason wins (Flow G, FR-09). Exit is never capped (FR-22). */
export function exitBlock(input: ExitGateInput): ExitBlock | null {
  const { network } = input;
  const block = (reason: ExitBlockReason, outcome: Outcome | null): ExitBlock => ({ reason, outcome });
  const blocker = writeBlocker(network, input.walletChainId);
  if (blocker === "no-executor") return block("no-executor", noExecutor(network));
  if (blocker === "wrong-network") return block("wrong-network", wrongNetwork(network));
  if (input.lpBalance === 0n) return block("no-lp", NO_LP);
  if (input.liquidityIn > input.lpBalance) return block("lp-changed", LP_CHANGED);
  if (!input.quote) return block("too-small", AMOUNT_TOO_SMALL);
  if (input.quote.priceImpact > PRICE_IMPACT_LIMIT) return block("price-impact", PRICE_IMPACT);
  if (input.lacksGas) return block("needs-gas", needsGas(network));
  if (input.quoteAgeMs > QUOTE_TTL_MS) return block("quote-expired", QUOTE_EXPIRED);
  return null;
}
```

Create `web/src/lib/positions/exit-steps.ts`:

```ts
import { needsApproval } from "@/lib/routes/musd-btc-lp/params";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

export type ExitStepKind = "permit" | "approve" | "exit";

/** EOA: an LP permit; smart account or unknown: an exact LP approval; nothing when the allowance covers it. */
export function exitSteps(kind: WalletKind, allowance: bigint, liquidityIn: bigint): ExitStepKind[] {
  if (!needsApproval(allowance, liquidityIn)) return ["exit"];
  return walletCapabilities(kind).permit ? ["permit", "exit"] : ["approve", "exit"];
}
```

Create `web/src/lib/positions/exit-params.ts`:

```ts
import { encodeFunctionData, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";
import { NO_PERMIT, type ExecutorPermit } from "@/lib/routes/musd-btc-lp/params";

/** The executor's ExitParams (spec 11.2). */
export type ExitParams = {
  liquidityIn: bigint;
  minMusdRemoved: bigint;
  minBtcRemoved: bigint;
  minMusdFromSwap: bigint;
  minMusdOut: bigint;
  deadline: bigint;
  recipient: Address;
};

/** ExitParams from a fresh quote; the recipient is always the caller's own account. */
export function buildExitParams(quote: ExitQuote, minimums: ExitMinimums, deadline: bigint, recipient: Address): ExitParams {
  return { liquidityIn: quote.liquidityIn, ...minimums, deadline, recipient };
}

export function encodeExitCall(params: ExitParams, permit: ExecutorPermit = NO_PERMIT): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "exit", args: [params, permit] });
}
```

Create `web/src/lib/positions/exit-preview.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import { exitMinimums, quoteExit, type ExitMinimums, type ExitQuote } from "@/lib/quote/exit";
import { exitGasUnits } from "@/lib/quote/gas";
import { DEADLINE_SECONDS } from "@/lib/routes/musd-btc-lp/params";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { exitBlock, type ExitBlock } from "./exit-gate";
import { exitLiquidity, type ExitIntent } from "./exit-intent";
import { exitSteps, type ExitStepKind } from "./exit-steps";
import type { PositionsData } from "./snapshot";

export type ExitPreview = {
  liquidityIn: bigint;
  quote: ExitQuote | null;
  minimums: ExitMinimums | null;
  steps: ExitStepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  block: ExitBlock | null;
};

/**
 * Everything the exit page shows and gates on, from one snapshot. `liquidityIn` is the amount the
 * flow pinned when its first step started; before that it follows the percent.
 */
export function exitPreview(input: {
  network: NetworkConfig;
  data: PositionsData;
  intent: ExitIntent;
  liquidityIn?: bigint;
  walletKind: WalletKind;
  walletChainId: number | undefined;
  now: number;
}): ExitPreview {
  const { snapshot } = input.data;
  const liquidityIn = input.liquidityIn ?? exitLiquidity(snapshot.lpBalance, input.intent.percent);
  const quote = quoteExit(snapshot.pool, liquidityIn);
  const steps = exitSteps(input.walletKind, snapshot.allowance, liquidityIn);
  const gasUnits = exitGasUnits({ approve: steps.includes("approve"), smartAccount: input.walletKind === "smart-account" });
  return {
    liquidityIn,
    quote,
    minimums: quote && exitMinimums(quote, input.intent.slippageBps),
    steps,
    gasUnits,
    gasCost: input.data.gasPrice === undefined ? null : gasUnits * input.data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    block: exitBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      lpBalance: snapshot.lpBalance,
      liquidityIn,
      quote,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
      quoteAgeMs: input.now - input.data.fetchedAt,
    }),
  };
}
```

Create `web/src/lib/positions/claim.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { needsGas, noExecutor, NOTHING_TO_CLAIM, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { Fees } from "./fees";

export type ClaimBlock = { reason: "no-executor" | "wrong-network" | "nothing-to-claim" | "needs-gas"; outcome: Outcome };

/** Why Claim is disabled (Flow G2). Mainnet stays read-only until M1, like every other write. */
export function claimBlock(input: {
  network: NetworkConfig;
  walletChainId: number | undefined;
  fees: Fees;
  lacksGas: boolean;
}): ClaimBlock | null {
  const blocker = writeBlocker(input.network, input.walletChainId);
  if (blocker === "no-executor") return { reason: "no-executor", outcome: noExecutor(input.network) };
  if (blocker === "wrong-network") return { reason: "wrong-network", outcome: wrongNetwork(input.network) };
  if (input.fees.musd === 0n && input.fees.btc === 0n) return { reason: "nothing-to-claim", outcome: NOTHING_TO_CLAIM };
  if (input.lacksGas) return { reason: "needs-gas", outcome: needsGas(input.network) };
  return null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npx vitest run src/lib && npx tsc --noEmit`
Expected: PASS (all lib tests, including the unchanged F3/F4 intent, stepper, and gate tests); no type errors. If `decode.test.ts` enumerates every `ErrorKind` (it does for the toast labels in some repos), add the three kinds where it lists them and ledger it.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/routes/musd-btc-lp/intent.ts web/src/lib/errors/types.ts web/src/lib/errors/outcomes.ts web/src/lib/tx/stepper.ts web/src/lib/tx/stepper.test.ts web/src/lib/routes/musd-btc-lp/useEntryFlow.ts web/src/components/lp/BlockNotice.tsx web/src/lib/positions/exit-intent.ts web/src/lib/positions/exit-intent.test.ts web/src/lib/positions/exit-gate.ts web/src/lib/positions/exit-gate.test.ts web/src/lib/positions/exit-steps.ts web/src/lib/positions/exit-steps.test.ts web/src/lib/positions/exit-params.ts web/src/lib/positions/exit-params.test.ts web/src/lib/positions/exit-preview.ts web/src/lib/positions/exit-preview.test.ts web/src/lib/positions/claim.ts web/src/lib/positions/claim.test.ts
git commit -m "feat(web): gate, plan, and preview an LP exit and a fee claim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Receipts for `Exited` and the pool's `Claim`

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/receipt.ts`, `web/src/lib/positions/claim.ts`, `web/src/components/receipt/ReceiptPage.tsx`
- Create: `web/src/lib/tx/receipt-kind.ts`
- Test: `web/src/lib/routes/musd-btc-lp/receipt.test.ts` (added cases), `web/src/lib/positions/claim.test.ts` (added cases), `web/src/lib/tx/receipt-kind.test.ts`

**Interfaces:**
- Consumes: `ExitedEvent` (Task 3), `Fees` (Task 2), `poolAbi` with `Claim` (Task 2), `musdIsToken0`.
- Produces:
  - `findExitedEvent(logs, executor): ExitedEvent | null`, `exitedRows(event): { label: string; value: string }[]`
  - `findClaimEvent(logs, network): Fees | null`, `claimRows(fees): { label: string; value: string }[]`
  - `type ReceiptKind = { kind: "entered"; event: EnteredEvent } | { kind: "exited"; event: ExitedEvent } | { kind: "claim"; fees: Fees } | null`; `receiptKind(logs, network): ReceiptKind`

- [ ] **Step 1: Write the failing tests**

Add to `web/src/lib/routes/musd-btc-lp/receipt.test.ts` (import `exitedRows`, `findExitedEvent` alongside the existing imports):

```ts
// The live smoke exit, tx 0x38a45ffe…7e30 (2 Oct 2026).
const exitedLog = {
  address: "0xb36b2e012003840951cff00fa6b1e3237a110920",
  topics: [
    "0x60d07dbee244732f25c764b0682faec5d991001c2be707658ecaf4d12db76c23",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
  ],
  data: "0x00000000000000000000000000000000000000000000000000fcd376919622bc000000000000000000000000000000000000000000000001152acf247df896e50000000000000000000000000000000000000000000000000000e6a1bdd82f39000000000000000000000000000000000000000000000001150e69d644fb1b290000000000000000000000000000000000000000000000022a3938fac2f3b20e0000000000000000000000000000000000000000000000000000000000000000",
} as const;

describe("findExitedEvent", () => {
  it("decodes the live smoke Exited event", () => {
    expect(findExitedEvent([enteredLog, exitedLog], EXECUTOR)).toEqual({
      caller: ME,
      recipient: ME,
      liquidityIn: 71164200333222588n,
      musdRemoved: 19972003253167101669n,
      btcRemoved: 253582349184825n,
      musdFromSwap: 19964010567181212457n,
      musdOut: 39936013820348314126n,
      btcRefund: 0n,
    });
  });

  it("ignores another contract and an Entered event", () => {
    expect(findExitedEvent([{ ...exitedLog, address: "0x0000000000000000000000000000000000000001" }], EXECUTOR)).toBeNull();
    expect(findExitedEvent([enteredLog], EXECUTOR)).toBeNull();
  });
});

describe("exitedRows", () => {
  it("lists the live exit's values for the receipt", () => {
    expect(exitedRows(findExitedEvent([exitedLog], EXECUTOR)!)).toEqual([
      { label: "LP exited", value: "0.071164 LP" },
      { label: "MUSD from the pool", value: "19.972003 MUSD" },
      { label: "BTC from the pool", value: "0.000253 BTC" },
      { label: "MUSD from selling the BTC", value: "19.96401 MUSD" },
      { label: "MUSD received", value: "39.936013 MUSD" },
      { label: "BTC returned", value: "0 BTC" },
    ]);
  });
});
```

Add to `web/src/lib/positions/claim.test.ts` (import `claimRows`, `findClaimEvent`):

```ts
// A live claim on the testnet pool, tx 0xa2e6e1a0…cdf05 (block 16043462), by 0x50A2…63fe.
const claimLog = {
  address: "0xd16a5df82120ed8d626a1a15232bfce2366d6aa9",
  topics: [
    "0x865ca08d59f5cb456e85cd2f7ef63664ea4f73327414e9d8152c4158b0e94645",
    "0x00000000000000000000000050a20e21c2be8f86746bfb8233854ad3569863fe",
    "0x00000000000000000000000050a20e21c2be8f86746bfb8233854ad3569863fe",
  ],
  data: "0x000000000000000000000000000000000000000000000000056e26faeb77855000000000000000000000000000000000000000000000000000000510050ecba8",
} as const;

describe("findClaimEvent", () => {
  it("decodes the live Claim with token0 as MUSD on testnet", () => {
    expect(findClaimEvent([claimLog], testnet)).toEqual({ musd: 391293076761970000n, btc: 5566362471336n });
  });

  it("maps amount0 to BTC on mainnet", () => {
    const mainnetLog = { ...claimLog, address: networks.mainnet.addresses.pool.toLowerCase() as `0x${string}` };
    expect(findClaimEvent([mainnetLog], networks.mainnet)).toEqual({ musd: 5566362471336n, btc: 391293076761970000n });
  });

  it("ignores a Claim from another contract", () => {
    expect(findClaimEvent([{ ...claimLog, address: "0x0000000000000000000000000000000000000001" }], testnet)).toBeNull();
  });
});

describe("claimRows", () => {
  it("lists the claimed fees", () => {
    expect(claimRows({ musd: 391293076761970000n, btc: 5566362471336n })).toEqual([
      { label: "MUSD claimed", value: "0.391293 MUSD" },
      { label: "BTC claimed", value: "0.000005 BTC" },
    ]);
  });
});
```

Create `web/src/lib/tx/receipt-kind.test.ts`:

```ts
import { encodeAbiParameters, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { receiptKind } from "./receipt-kind";

const testnet = networks.testnet;
const word = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]).slice(2);
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const claim = {
  address: testnet.addresses.pool,
  topics: ["0x865ca08d59f5cb456e85cd2f7ef63664ea4f73327414e9d8152c4158b0e94645", topic(ME), topic(ME)] as Hex[],
  data: `0x${word(3n)}${word(4n)}` as Hex,
};

describe("receiptKind", () => {
  it("finds a pool Claim when the receipt has no executor event", () => {
    expect(receiptKind([claim], testnet)).toEqual({ kind: "claim", fees: { musd: 3n, btc: 4n } });
  });

  it("is null for a receipt without MezoRoute or pool events", () => {
    expect(receiptKind([], testnet)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp/receipt.test.ts src/lib/positions/claim.test.ts src/lib/tx/receipt-kind.test.ts`
Expected: FAIL (`findExitedEvent`, `findClaimEvent`, `./receipt-kind` missing).

- [ ] **Step 3: Implement**

Append to `web/src/lib/routes/musd-btc-lp/receipt.ts`:

```ts
/** The executor's `Exited` event from a receipt (FR-11: receipts show event values only). */
export function findExitedEvent(logs: readonly LogLike[], executor: Address): ExitedEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "Exited",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      return decoded.args as ExitedEvent;
    } catch {
      // Another executor event (e.g. Entered); keep looking.
    }
  }
  return null;
}

/** The exit receipt's rows: realised values from the event, six decimals. */
export function exitedRows(event: ExitedEvent): { label: string; value: string }[] {
  const musd = (value: bigint) => `${formatToken(value)} MUSD`;
  const btc = (value: bigint) => `${formatToken(value)} BTC`;
  return [
    { label: "LP exited", value: `${formatToken(event.liquidityIn)} LP` },
    { label: "MUSD from the pool", value: musd(event.musdRemoved) },
    { label: "BTC from the pool", value: btc(event.btcRemoved) },
    { label: "MUSD from selling the BTC", value: musd(event.musdFromSwap) },
    { label: "MUSD received", value: musd(event.musdOut) },
    { label: "BTC returned", value: btc(event.btcRefund) },
  ];
}
```

Also export `LogLike` from `receipt.ts` (`export type LogLike = …`) so `claim.ts` and `receipt-kind.ts` reuse it.

Append to `web/src/lib/positions/claim.ts` (add imports `decodeEventLog, isAddressEqual, type Hex` from `viem`, `poolAbi` from `@/lib/abi/pool`, `musdIsToken0` from `@/lib/dashboard/snapshot`, `formatToken` from `@/lib/format`, `type LogLike` from `@/lib/routes/musd-btc-lp/receipt`):

```ts
/** The pool's `Claim` event from a receipt, as MUSD and BTC (token order mapped by address). */
export function findClaimEvent(logs: readonly LogLike[], network: NetworkConfig): Fees | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, network.addresses.pool) || log.topics.length === 0) continue;
    try {
      const { args } = decodeEventLog({ abi: poolAbi, eventName: "Claim", topics: log.topics as [Hex, ...Hex[]], data: log.data });
      return musdIsToken0(network) ? { musd: args.amount0, btc: args.amount1 } : { musd: args.amount1, btc: args.amount0 };
    } catch {
      // Another pool event (Transfer, Sync, …); keep looking.
    }
  }
  return null;
}

export function claimRows(fees: Fees): { label: string; value: string }[] {
  return [
    { label: "MUSD claimed", value: `${formatToken(fees.musd)} MUSD` },
    { label: "BTC claimed", value: `${formatToken(fees.btc)} BTC` },
  ];
}
```

Create `web/src/lib/tx/receipt-kind.ts`:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import { findClaimEvent } from "@/lib/positions/claim";
import type { Fees } from "@/lib/positions/fees";
import {
  findEnteredEvent,
  findExitedEvent,
  type EnteredEvent,
  type ExitedEvent,
  type LogLike,
} from "@/lib/routes/musd-btc-lp/receipt";

export type ReceiptKind =
  | { kind: "entered"; event: EnteredEvent }
  | { kind: "exited"; event: ExitedEvent }
  | { kind: "claim"; fees: Fees }
  | null;

/** What a confirmed transaction did, from its logs: an entry, an exit, or a fee claim. */
export function receiptKind(logs: readonly LogLike[], network: NetworkConfig): ReceiptKind {
  const executor = network.executor?.address;
  const entered = executor ? findEnteredEvent(logs, executor) : null;
  if (entered) return { kind: "entered", event: entered };
  const exited = executor ? findExitedEvent(logs, executor) : null;
  if (exited) return { kind: "exited", event: exited };
  const fees = findClaimEvent(logs, network);
  return fees ? { kind: "claim", fees } : null;
}
```

In `web/src/components/receipt/ReceiptPage.tsx`:
- Replace the import of `enteredRows, findEnteredEvent` with `enteredRows, exitedRows` from `@/lib/routes/musd-btc-lp/receipt`, add `import { claimRows } from "@/lib/positions/claim";` and `import { receiptKind } from "@/lib/tx/receipt-kind";`.
- Replace the `Confirmed` component with:

```tsx
const TITLES = { entered: "Deposit confirmed", exited: "Exit confirmed", claim: "Fees claimed" } as const;

function Confirmed({ receipt }: { receipt: TransactionReceipt }) {
  const { network } = useNetwork();
  const result = receiptKind(receipt.logs, network);
  if (!result) {
    return (
      <>
        <h1 className="text-lg font-semibold">Transaction confirmed</h1>
        <p className="mt-2 text-sm text-muted">This transaction has no MezoRoute action.</p>
      </>
    );
  }
  const borrowed = result.kind === "entered" && result.event.musdBorrowed > 0n;
  const rows =
    result.kind === "entered" ? enteredRows(result.event) : result.kind === "exited" ? exitedRows(result.event) : claimRows(result.fees);
  return (
    <>
      <h1 className="text-lg font-semibold">{borrowed ? "Borrow & deposit confirmed" : TITLES[result.kind]}</h1>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {rows.map((row) => (
          <StatRow key={row.label} label={row.label}>
            {row.value}
          </StatRow>
        ))}
        <StatRow label="Gas used">{formatToken(receipt.gasUsed, 0, 0)}</StatRow>
        <StatRow label="Block">{receipt.blockNumber.toString()}</StatRow>
      </dl>
      {borrowed && <TroveNow />}
    </>
  );
}
```

- In `Failed`, change the fallback heading `"Deposit failed"` to `"Transaction failed"`.
- Replace `BackLink` with links to both places (spec §9 screen 4: "View positions"):

```tsx
function BackLink() {
  return (
    <span className="flex gap-3">
      <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
        View positions
      </Link>
      <Link href="/" className="text-xs font-semibold text-accent hover:underline">
        Back to dashboard
      </Link>
    </span>
  );
}
```

- Update the file's doc comment to "values from the Entered, Exited, or pool Claim event only (FR-11, FR-13)".

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && npm test && npm run build`
Expected: all tests PASS; build OK (`check-relayer-bundle: ok`).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/routes/musd-btc-lp/receipt.ts web/src/lib/routes/musd-btc-lp/receipt.test.ts web/src/lib/positions/claim.ts web/src/lib/positions/claim.test.ts web/src/lib/tx/receipt-kind.ts web/src/lib/tx/receipt-kind.test.ts web/src/components/receipt/ReceiptPage.tsx
git commit -m "feat(web): show exits and fee claims on the receipt page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hooks — snapshot, history, claim, exit flow

**Files:**
- Create: `web/src/lib/positions/usePositionsSnapshot.ts`, `web/src/lib/positions/usePositionsHistory.ts`, `web/src/lib/positions/useClaimFees.ts`, `web/src/lib/positions/useExitFlow.ts`

**Interfaces:**
- Consumes: Tasks 2–6; `submitCall`, `confirmCall`, `SendPin`; `BlockedError`; `decodeError`; `useErrorToast`; `toExecutorPermit`, `permitUsable`; `encodeApproveCall`, `NO_PERMIT`, `DEADLINE_SECONDS`; `QUOTE_REFRESH_MS`.
- Produces:
  - `usePositionsSnapshot(account): { data: PositionsData | undefined; error: Error | null; refresh: () => Promise<PositionsData> }`
  - `usePositionsHistory(account): { events: HistoryEvent[] | undefined; error: Error | null; retry: () => void }`
  - `useClaimFees(account): { claim: () => void; pending: boolean }`
  - `type ExitFlowInput = { account: Address; executor: Address; intent: ExitIntent; liquidityIn: bigint; walletKind: WalletKind; plan: ExitStepKind[]; refresh: () => Promise<PositionsData> }`; `useExitFlow(input): { stepper: Stepper<ExitStepKind>; run: () => void }`

These hooks are thin wiring over tested pure modules (as F3's `useEntryFlow`); they are exercised by `npm run build` here and by the live QA in Task 10.

- [ ] **Step 1: Write `usePositionsSnapshot.ts`**

```ts
"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { parsePositionsSnapshot, positionsContracts, type PositionsData, type PositionsResults } from "./snapshot";

/**
 * The positions reads on the selected network: one multicall snapshot plus gas balance and price,
 * refetched every 15 s. `refresh` resolves with fresh data (the exit's send re-quotes from it).
 */
export function usePositionsSnapshot(account: Address): {
  data: PositionsData | undefined;
  error: Error | null;
  refresh: () => Promise<PositionsData>;
} {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: positionsContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: QUOTE_REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (results: unknown, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): PositionsData => ({
    snapshot: parsePositionsSnapshot(network, results as PositionsResults),
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
      if (!freshReads.data || !freshGas.data) throw new Error("Positions snapshot unavailable");
      return toData(freshReads.data, freshGas.data.value, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
```

- [ ] **Step 2: Write `usePositionsHistory.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { historyKey, loadHistory, parseHistory, serializeHistory, type HistoryCache, type HistoryEvent } from "./history";
import { readExecutorEvents, type LogsClient } from "./history-reader";

const HISTORY_REFRESH_MS = 60_000;

function readStored(key: string): HistoryCache | null {
  try {
    return parseHistory(window.localStorage.getItem(key));
  } catch {
    return null; // storage blocked: scan from the deployment block
  }
}

function writeStored(key: string, cache: HistoryCache): void {
  try {
    window.localStorage.setItem(key, serializeHistory(cache));
  } catch {
    // A full or blocked storage only costs a longer scan next time.
  }
}

/**
 * The account's executor events for the cost basis (spec §12 "Positions data"). The cache is a
 * convenience: a failed scan reports an error and writes nothing. Without an executor there is no history.
 */
export function usePositionsHistory(account: Address): {
  events: HistoryEvent[] | undefined;
  error: Error | null;
  retry: () => void;
} {
  const { network } = useNetwork();
  const client = usePublicClient({ chainId: network.chainId });
  const executor = network.executor;
  const query = useQuery({
    queryKey: ["positions-history", network.chainId, executor?.address, account],
    enabled: client !== undefined && executor !== null,
    refetchInterval: HISTORY_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (!client || !executor) return [];
      const key = historyKey(network, executor.address, account);
      const { events, cache } = await loadHistory({
        read: (range) => readExecutorEvents(client as unknown as LogsClient, executor.address, account, range),
        head: await client.getBlockNumber({ cacheTime: 0 }),
        deployBlock: executor.deployBlock,
        cache: readStored(key),
      });
      if (cache) writeStored(key, cache);
      return events;
    },
  });
  if (!executor) return { events: [], error: null, retry: () => undefined };
  return { events: query.data, error: query.error, retry: () => void query.refetch() };
}
```

- [ ] **Step 3: Write `useClaimFees.ts`**

```ts
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { useConfig } from "wagmi";
import { simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { poolAbi } from "@/lib/abi/pool";
import { useNetwork } from "@/lib/config/network-context";
import { submitCall } from "@/lib/tx/send";

/** Flow G2: the user calls `Pool.claimFees()` directly (simulated first); the receipt decodes `Claim`. */
export function useClaimFees(account: Address): { claim: () => void; pending: boolean } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [pending, setPending] = useState(false);

  async function run() {
    const pin = { account, chainId: network.chainId };
    setPending(true);
    try {
      await simulateContract(config, {
        address: network.addresses.pool,
        abi: poolAbi,
        functionName: "claimFees",
        account: pin.account,
        chainId: pin.chainId,
      });
      const data = encodeFunctionData({ abi: poolAbi, functionName: "claimFees" });
      const hash = await submitCall(config, { to: network.addresses.pool, data }, pin);
      router.push(`/tx/?hash=${hash}`);
    } catch (error) {
      showError(error, { retry: () => void run() });
    } finally {
      setPending(false);
    }
  }

  return { claim: () => void run(), pending };
}
```

- [ ] **Step 4: Write `useExitFlow.ts`**

```ts
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { DEADLINE_SECONDS, encodeApproveCall, NO_PERMIT, type ExecutorPermit } from "@/lib/routes/musd-btc-lp/params";
import { permitUsable, toExecutorPermit } from "@/lib/routes/musd-btc-lp/permit";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import type { ExitIntent } from "./exit-intent";
import { buildExitParams, encodeExitCall } from "./exit-params";
import { exitPreview } from "./exit-preview";
import type { ExitStepKind } from "./exit-steps";
import { lpPermitTypedData } from "./lp-permit";
import type { PositionsData } from "./snapshot";

export type ExitFlowInput = {
  account: Address;
  executor: Address;
  intent: ExitIntent;
  liquidityIn: bigint; // follows the percent until the first step pins it
  walletKind: WalletKind;
  plan: ExitStepKind[];
  refresh: () => Promise<PositionsData>;
};

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

/**
 * The exit stepper (spec §9 screen 6a): LP permit (EOA) or exact LP approval (smart account), then
 * `exit`. The account, chain, and LP amount are pinned on the first step; the send re-quotes,
 * re-gates, simulates, submits, and hands the hash to the receipt page.
 */
export function useExitFlow(input: ExitFlowInput): { stepper: Stepper<ExitStepKind>; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<ExitStepKind>, input.plan, createStepper<ExitStepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const pinnedLiquidity = useRef<bigint | null>(null);
  const permit = useRef<ExecutorPermit | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as ExitStepKind[] });
  }, [planKey]);

  const liquidityIn = () => pinnedLiquidity.current ?? input.liquidityIn;

  async function signPermit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const deadline = fresh.snapshot.blockTimestamp + DEADLINE_SECONDS;
    const value = liquidityIn();
    const typedData = lpPermitTypedData({
      network,
      owner: sendPin.account,
      spender: input.executor,
      value,
      nonce: fresh.snapshot.permitNonce,
      deadline,
    });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    permit.current = toExecutorPermit(signature, value, deadline);
    dispatch({ type: "signed" });
  }

  async function approve(sendPin: SendPin) {
    const call = { to: network.addresses.pool, data: encodeApproveCall(input.executor, liquidityIn()) };
    const hash = await submitCall(config, call, sendPin);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function exit(sendPin: SendPin) {
    const hasPermitStep = stepperRef.current.steps.some((step) => step.kind === "permit");
    const signed = permit.current;
    if (hasPermitStep && (!signed || !permitUsable(signed, nowSeconds()))) {
      permit.current = null;
      dispatch({ type: "signature-expired" });
      throw new BlockedError(PERMIT_EXPIRED);
    }
    const fresh = await input.refresh();
    const preview = exitPreview({
      network,
      data: fresh,
      intent: input.intent,
      liquidityIn: liquidityIn(),
      walletKind: input.walletKind,
      walletChainId: getAccount(config).chainId,
      now: Date.now(),
    });
    if (preview.block) throw new BlockedError(preview.block.outcome ?? AMOUNT_TOO_SMALL);
    if (!preview.quote || !preview.minimums) throw new BlockedError(AMOUNT_TOO_SMALL);
    const params = buildExitParams(preview.quote, preview.minimums, preview.deadline, sendPin.account);
    const usedPermit = hasPermitStep && signed ? signed : NO_PERMIT;
    // A simulated revert is decoded and nothing is sent.
    await simulateContract(config, {
      address: input.executor,
      abi: mezoRouteExecutorAbi,
      functionName: "exit",
      args: [params, usedPermit],
      account: sendPin.account,
      chainId: sendPin.chainId,
    });
    const hash = await submitCall(config, { to: input.executor, data: encodeExitCall(params, usedPermit) }, sendPin);
    dispatch({ type: "submitted", hash });
    router.push(`/tx/?hash=${hash}`);
  }

  async function runActive() {
    const step = stepperRef.current.steps[stepperRef.current.active];
    if (!step) return;
    pin.current ??= { account: input.account, chainId: network.chainId };
    pinnedLiquidity.current ??= input.liquidityIn;
    const sendPin = pin.current;
    dispatch({ type: "start" });
    try {
      if (step.kind === "permit") await signPermit(sendPin);
      else if (step.kind === "approve") await approve(sendPin);
      else await exit(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, {
        retry: () => void runActive(),
        refreshQuote: () => void input.refresh().catch(() => undefined),
      });
    }
  }

  return { stepper, run: () => void runActive() };
}
```

- [ ] **Step 5: Build and commit**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS. (If `usePublicClient`'s client type is not assignable through `as unknown as LogsClient`, keep the cast: the reader's behaviour is pinned by its unit test and the live QA; ledger anything else.)

```bash
git add web/src/lib/positions/usePositionsSnapshot.ts web/src/lib/positions/usePositionsHistory.ts web/src/lib/positions/useClaimFees.ts web/src/lib/positions/useExitFlow.ts
git commit -m "feat(web): wire the positions reads, history scan, claim, and exit flow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Positions page, header link, dashboard summary

**Files:**
- Create: `web/src/app/positions/page.tsx`, `web/src/components/positions/PositionsPage.tsx`, `web/src/components/positions/LpPositionCard.tsx`, `web/src/components/positions/FeesCard.tsx`, `web/src/components/dashboard/PositionsSummary.tsx`
- Modify: `web/src/components/Header.tsx`, `web/src/components/dashboard/Dashboard.tsx`, `web/src/components/lp/units.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 7; `StatRow`; `BlockNotice`; `musd`, `btc`, `lp` from `@/components/lp/units`; `formatPercent`.
- Produces: route `/positions/`; `signedMusd(value: bigint): string` in `units.ts`.

- [ ] **Step 1: Add the signed formatter**

Append to `web/src/components/lp/units.ts`:

```ts
/** A signed MUSD change: "+1.5 MUSD" / "−0.06 MUSD" (true minus sign). */
export const signedMusd = (value: bigint) => (value < 0n ? `−${musd(-value)}` : `+${musd(value)}`);
```

- [ ] **Step 2: Write the page and cards**

Create `web/src/app/positions/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const PositionsPage = dynamic(() => import("@/components/positions/PositionsPage"), { ssr: false });

export default function Page() {
  return <PositionsPage />;
}
```

Create `web/src/components/positions/PositionsPage.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { claimBlock } from "@/lib/positions/claim";
import { usePositionsHistory } from "@/lib/positions/usePositionsHistory";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { FeesCard } from "./FeesCard";
import { LpPositionCard } from "./LpPositionCard";

/** Spec §9 screen 5, LP part (the Stability Pool block arrives with F5). */
export default function PositionsPage() {
  return <RequireWallet>{(account) => <Positions account={account} />}</RequireWallet>;
}

function Positions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { data, error, refresh } = usePositionsSnapshot(account);
  const history = usePositionsHistory(account);

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading your positions" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const view = positionView(data.snapshot, history.events ?? null);
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
      {view.empty ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm">You have no MUSD/BTC LP and no unclaimed pool fees on {network.name}.</p>
          <Link href="/route/lp/" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
            Deposit MUSD into the pool
          </Link>
        </section>
      ) : (
        <>
          {view.lp.balance > 0n && <LpPositionCard lp={view.lp} history={history} />}
          <FeesCard account={account} fees={view.fees} block={block} />
        </>
      )}
    </>
  );
}
```

Create `web/src/components/positions/LpPositionCard.tsx`:

```tsx
import Link from "next/link";
import { StatRow } from "@/components/dashboard/StatRow";
import { btc, lp as lpUnits, musd, signedMusd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import { DEFAULT_EXIT_INTENT, exitQuery } from "@/lib/positions/exit-intent";
import type { LpView } from "@/lib/positions/view";

type History = { events: unknown; error: Error | null; retry: () => void };

/** Flow F: what the LP holds, what it would return now, and what it cost (estimates, never "profit"). */
export function LpPositionCard({ lp, history }: { lp: LpView; history: History }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">MUSD/BTC pool</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="LP balance" sub={`${formatPercent(lp.share, 4)} of the pool`}>
          {lpUnits(lp.balance)}
        </StatRow>
        <StatRow label="Underlying MUSD">{musd(lp.musd)}</StatRow>
        <StatRow label="Underlying BTC" sub={`≈ ${musd(lp.btcValue)}`}>
          {btc(lp.btc)}
        </StatRow>
        <StatRow label="If you exit everything now" sub="Estimated, after the pool fee" strong>
          {lp.exit ? musd(lp.exit.musdOut) : "—"}
        </StatRow>
        <CostRows lp={lp} history={history} />
      </dl>
      {lp.cost && lp.cost.unattributedLp > 0n && (
        <p className="mt-2 text-xs text-muted">
          {lpUnits(lp.cost.unattributedLp)} was not deposited through MezoRoute and has no cost basis.
        </p>
      )}
      <Link
        href={`/positions/lp/exit/${exitQuery(DEFAULT_EXIT_INTENT)}`}
        className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
      >
        Exit to MUSD
      </Link>
    </section>
  );
}

function CostRows({ lp, history }: { lp: LpView; history: History }) {
  if (history.error) {
    return (
      <StatRow label="Cost basis">
        Unavailable{" "}
        <button type="button" onClick={history.retry} className="text-xs font-semibold text-accent hover:underline">
          Retry
        </button>
      </StatRow>
    );
  }
  if (!lp.cost) return <StatRow label="Cost basis">Loading…</StatRow>;
  if (lp.cost.coveredLp === 0n) return <StatRow label="Cost basis">No MezoRoute deposits</StatRow>;
  return (
    <>
      <StatRow label="Cost basis" sub={`incl. ${musd(lp.cost.coveredFees)} MezoRoute fees`}>
        {musd(lp.cost.coveredBasis)}
      </StatRow>
      {lp.valueChange !== null && (
        <StatRow label="Estimated position value change" sub="Exit value minus cost basis">
          {signedMusd(lp.valueChange)}
        </StatRow>
      )}
    </>
  );
}
```

Create `web/src/components/positions/FeesCard.tsx`:

```tsx
"use client";

import type { Address } from "viem";
import { StatRow } from "@/components/dashboard/StatRow";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import type { ClaimBlock } from "@/lib/positions/claim";
import { useClaimFees } from "@/lib/positions/useClaimFees";
import type { FeesView } from "@/lib/positions/view";

/** Flow G2: the pool's swap fees owed to this account, paid only when it calls claimFees(). */
export function FeesCard({ account, fees, block }: { account: Address; fees: FeesView; block: ClaimBlock | null }) {
  const { claim, pending } = useClaimFees(account);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Pool fees earned</h2>
      <p className="mt-1 text-xs text-muted">The pool pays its trading fees to LP holders when they claim. Claiming does not touch your LP.</p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="MUSD">{musd(fees.musd)}</StatRow>
        <StatRow label="BTC" sub={`≈ ${musd(fees.btcValue)}`}>
          {btc(fees.btc)}
        </StatRow>
        <StatRow label="Total (estimated)" strong>
          {musd(fees.total)}
        </StatRow>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3">
        <BlockNotice block={block} />
        <button
          type="button"
          disabled={block !== null || pending}
          onClick={claim}
          className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {pending ? "Check your wallet…" : "Claim"}
        </button>
      </div>
    </section>
  );
}
```

Create `web/src/components/dashboard/PositionsSummary.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Address } from "viem";
import { musd } from "@/components/lp/units";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { StatRow } from "./StatRow";

/** Spec §9 screen 1 "positions summary": shown once there is LP or unclaimed fees. */
export function PositionsSummary({ account }: { account: Address }) {
  const { data } = usePositionsSnapshot(account);
  if (!data) return null;
  const view = positionView(data.snapshot, null);
  if (view.empty) return null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Your positions</h2>
        <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
          View positions
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="MUSD/BTC LP (estimated)">{musd(view.lp.value)}</StatRow>
        <StatRow label="Unclaimed pool fees (estimated)">{musd(view.fees.total)}</StatRow>
      </dl>
    </section>
  );
}
```

In `web/src/components/dashboard/Dashboard.tsx`, import `PositionsSummary` and render it last in `DashboardBody`:

```tsx
      <ExposurePanel snapshot={snapshot} />
      <PositionsSummary account={account} />
```

In `web/src/components/Header.tsx`, add a nav link after the logo link:

```tsx
      <nav className="mr-auto">
        <Link href="/positions/" className="text-sm font-semibold text-muted hover:text-accent">
          Positions
        </Link>
      </nav>
```

(Place it between the logo `<Link>` and `<NetworkSwitch />`; the header is `justify-between`, and `mr-auto` keeps the switch and the wallet button on the right.)

- [ ] **Step 3: Build**

Run: `cd web && npm test && npm run build`
Expected: tests PASS; build OK; the export lists `/positions`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/positions/page.tsx web/src/components/positions/PositionsPage.tsx web/src/components/positions/LpPositionCard.tsx web/src/components/positions/FeesCard.tsx web/src/components/dashboard/PositionsSummary.tsx web/src/components/dashboard/Dashboard.tsx web/src/components/Header.tsx web/src/components/lp/units.ts
git commit -m "feat(web): add the positions page with LP value, cost basis, and fee claims

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Exit page

**Files:**
- Create: `web/src/app/positions/lp/exit/page.tsx`, `web/src/components/positions/ExitPage.tsx`, `web/src/components/positions/ExitForm.tsx`, `web/src/components/positions/ExitPreviewCard.tsx`, `web/src/components/positions/ExitStepper.tsx`
- Modify: `web/src/components/lp/EntryStepper.tsx` (export `StepAction`, typed for any step)

**Interfaces:**
- Consumes: Tasks 5, 7; `NoExecutorCard`; `useNow`; `useWalletKind`; `SLIPPAGE_PRESETS`; `formatBps`, `formatPercent`, `formatToken`.
- Produces: route `/positions/lp/exit/?percent=&slippage=`.

- [ ] **Step 1: Share the step button**

In `web/src/components/lp/EntryStepper.tsx`, export `StepAction` and type its step loosely:

```tsx
export function StepAction({
  step,
  active,
  disabled,
  label,
  onRun,
}: {
  step: Step<string>;
  active: boolean;
  disabled: boolean;
  label: string;
  onRun: () => void;
}) {
  if (step.status === "done") return <span className="shrink-0 text-xs font-semibold text-accent">Done</span>;
  if (step.status === "awaiting-wallet") return <span className="shrink-0 text-xs text-muted">Check your wallet…</span>;
  if (step.status === "submitted") return <span className="shrink-0 text-xs text-muted">Confirming…</span>;
  if (!active) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRun}
      className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
    >
      {step.status === "failed" ? "Try again" : label}
    </button>
  );
}
```

and in `EntryStepper` pass `label={COPY[step.kind].action}`.

- [ ] **Step 2: Write the exit page and its parts**

Create `web/src/app/positions/lp/exit/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const ExitPage = dynamic(() => import("@/components/positions/ExitPage"), { ssr: false });

export default function Page() {
  return <ExitPage />;
}
```

Create `web/src/components/positions/ExitPage.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { NoExecutorCard } from "@/components/lp/NoExecutorCard";
import { useNetwork } from "@/lib/config/network-context";
import { exitQuery, parseExitIntent, type ExitIntent } from "@/lib/positions/exit-intent";
import { exitPreview } from "@/lib/positions/exit-preview";
import type { PositionsData } from "@/lib/positions/snapshot";
import { useExitFlow } from "@/lib/positions/useExitFlow";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { hasStarted } from "@/lib/tx/stepper";
import { useNow } from "@/lib/useNow";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ExitForm } from "./ExitForm";
import { ExitPreviewCard } from "./ExitPreviewCard";
import { ExitStepper } from "./ExitStepper";

/** Spec §9 screen 6a: share or Max, quote, minimum MUSD, permit (smart account: approve) → send. */
export default function ExitPage() {
  return <RequireWallet>{(account) => <ExitRoute account={account} />}</RequireWallet>;
}

function ExitRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <NoExecutorCard />;
  return <ExitLoader account={account} executor={network.executor.address} />;
}

function ExitLoader({ account, executor }: { account: Address; executor: Address }) {
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<ExitIntent>(() => parseExitIntent(searchParams));
  const { data, error, refresh } = usePositionsSnapshot(account);

  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the quote" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }
  return (
    <ExitFlowView
      account={account}
      executor={executor}
      walletKind={walletKind}
      data={data}
      refresh={refresh}
      intent={intent}
      onIntent={(next) => {
        setIntent(next);
        window.history.replaceState(null, "", exitQuery(next));
      }}
    />
  );
}

function ExitFlowView(props: {
  account: Address;
  executor: Address;
  walletKind: WalletKind;
  data: PositionsData;
  refresh: () => Promise<PositionsData>;
  intent: ExitIntent;
  onIntent: (next: ExitIntent) => void;
}) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const now = useNow(1_000);
  const preview = exitPreview({
    network,
    data: props.data,
    intent: props.intent,
    walletKind: props.walletKind,
    walletChainId: chainId,
    now,
  });
  const { stepper, run } = useExitFlow({
    account: props.account,
    executor: props.executor,
    intent: props.intent,
    liquidityIn: preview.liquidityIn,
    walletKind: props.walletKind,
    plan: preview.steps,
    refresh: props.refresh,
  });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Exit the MUSD/BTC pool to MUSD</h1>
        <ExitForm intent={props.intent} lpBalance={props.data.snapshot.lpBalance} locked={hasStarted(stepper)} onChange={props.onIntent} />
      </section>
      {preview.quote && preview.minimums && (
        <ExitPreviewCard
          quote={preview.quote}
          minimums={preview.minimums}
          gasCost={preview.gasCost}
          blockNumber={props.data.snapshot.blockNumber}
        />
      )}
      <ExitStepper stepper={stepper} run={run} block={preview.block} />
      <Link href="/positions/" className="inline-block text-xs font-semibold text-accent hover:underline">
        Back to positions
      </Link>
    </>
  );
}
```

Create `web/src/components/positions/ExitForm.tsx`:

```tsx
import { lp } from "@/components/lp/units";
import { formatBps } from "@/lib/format";
import { EXIT_PERCENTS, type ExitIntent } from "@/lib/positions/exit-intent";
import { SLIPPAGE_PRESETS } from "@/lib/quote/entry";

const pill = (on: boolean) =>
  on ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted";

/** Share of the LP and slippage; locked once the first step starts (the flow pinned the amount). */
export function ExitForm({
  intent,
  lpBalance,
  locked,
  onChange,
}: {
  intent: ExitIntent;
  lpBalance: bigint;
  locked: boolean;
  onChange: (next: ExitIntent) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <fieldset disabled={locked}>
        <legend className="text-sm font-medium">Amount to exit</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {EXIT_PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              aria-pressed={percent === intent.percent}
              onClick={() => onChange({ ...intent, percent })}
              className={pill(percent === intent.percent)}
            >
              {percent === 100 ? "Max" : `${percent}%`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Your LP: {lp(lpBalance)}</p>
      </fieldset>
      <fieldset disabled={locked}>
        <legend className="text-sm font-medium">Slippage</legend>
        <div className="mt-1 flex gap-2">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps.toString()}
              type="button"
              aria-pressed={bps === intent.slippageBps}
              onClick={() => onChange({ ...intent, slippageBps: bps })}
              className={pill(bps === intent.slippageBps)}
            >
              {formatBps(bps, 1)}
            </button>
          ))}
        </div>
        {intent.slippageBps === 200n && (
          <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-ink">
            2% slippage lets this exit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </p>
        )}
      </fieldset>
    </div>
  );
}
```

Create `web/src/components/positions/ExitPreviewCard.tsx`:

```tsx
import { StatRow } from "@/components/dashboard/StatRow";
import { btc, lp, musd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";

/** FR-09: removal amounts, swap output, expected and minimum MUSD, gas; no fee on exit. */
export function ExitPreviewCard({
  quote,
  minimums,
  gasCost,
  blockNumber,
}: {
  quote: ExitQuote;
  minimums: ExitMinimums;
  gasCost: bigint | null;
  blockNumber: bigint;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Estimated result</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="LP to exit">{lp(quote.liquidityIn)}</StatRow>
        <StatRow label="MUSD from the pool">{musd(quote.musdRemoved)}</StatRow>
        <StatRow label="BTC from the pool">{btc(quote.btcRemoved)}</StatRow>
        <StatRow label="MUSD from selling the BTC">{musd(quote.musdFromSwap)}</StatRow>
        <StatRow label="You receive (estimated)" strong>
          {musd(quote.musdOut)}
        </StatRow>
        <StatRow label="Minimum you receive">{musd(minimums.minMusdOut)}</StatRow>
        <StatRow label="Price impact">{formatPercent(quote.priceImpact, 2)}</StatRow>
        <StatRow label="MezoRoute fee">None on exit</StatRow>
        <StatRow label="Network fee (estimated)">{gasCost === null ? "—" : btc(gasCost)}</StatRow>
      </dl>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Unclaimed pool fees stay claimable after you exit.</li>
        <li>The BTC half is sold for MUSD at the pool price; the minimum protects you from a worse fill.</li>
        <li>Quote from block {blockNumber.toString()}; it refreshes every 15 seconds and again before sending.</li>
      </ul>
    </section>
  );
}
```

Create `web/src/components/positions/ExitStepper.tsx`:

```tsx
"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { StepAction } from "@/components/lp/EntryStepper";
import type { ExitBlock } from "@/lib/positions/exit-gate";
import type { ExitStepKind } from "@/lib/positions/exit-steps";
import type { Stepper } from "@/lib/tx/stepper";

const COPY: Record<ExitStepKind, { title: string; detail: string; action: string }> = {
  permit: {
    title: "Sign an LP permit",
    detail: "Lets MezoRoute take exactly this LP in the next step. Signing costs no gas.",
    action: "Sign",
  },
  approve: {
    title: "Approve LP",
    detail: "Your Bitcoin wallet approves the exact LP amount in a separate transaction.",
    action: "Approve",
  },
  exit: {
    title: "Exit to MUSD",
    detail: "One transaction: remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
    action: "Send",
  },
};

export function ExitStepper({ stepper, run, block }: { stepper: Stepper<ExitStepKind>; run: () => void; block: ExitBlock | null }) {
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
      <div className="mt-3">
        <BlockNotice block={block} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build**

Run: `cd web && npm test && npm run build`
Expected: tests PASS; build OK; the export lists `/positions/lp/exit`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/positions/lp/exit/page.tsx web/src/components/positions/ExitPage.tsx web/src/components/positions/ExitForm.tsx web/src/components/positions/ExitPreviewCard.tsx web/src/components/positions/ExitStepper.tsx web/src/components/lp/EntryStepper.tsx
git commit -m "feat(web): add the LP exit page with permit or approval and a live quote

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Live QA on testnet (agent) and the measured exit gas

**Files:** `web/src/lib/quote/gas.ts` (measured `EXIT_GAS`) and the preview/gas test expectations; anything else only as a `fix(web):` with a failing test first.

- [ ] **Step 1:** `cd web && npm run build`, serve `web/out` on 4173 (`python3 -m http.server`), start the local QA signer from F3/F4 (scratchpad `qa-signer.mjs`), extended to allow: `Permit` typed data whose domain is the pool (`name ""`, version `"1"`, verifying contract = testnet pool) with spender = executor; sends to the executor, the pool (`claimFees`, `approve`), and MUSD only. Load its init script with `page.context().addInitScript({ path })`. Never print or copy the key; the signer reads it inside its own process.
- [ ] **Step 2:** `/positions/` with the deployer: LP balance, underlying, and exit value against `cast` reads at the snapshot block; claimable MUSD/BTC equal `cast call <pool> "claimFees()(uint256,uint256)" --from <deployer>` at the same block; cost basis loads (reload: the second load reads only from the cached `scannedTo`; check `localStorage` holds `mezoroute.testnet.history.…`).
- [ ] **Step 3:** Exit 50% (EOA permit path): Sign LP permit → Send → receipt "Exit confirmed". With `cast`: `quoteExit` on the pool at the previous block equals the `Exited` event (temporary test, deleted after); LP allowance deployer → executor = 0; executor MUSD/BTC/LP balances 0; no fee transfer in the receipt logs.
- [ ] **Step 4:** Claim: Claim → receipt "Fees claimed"; the `Claim` amounts equal the `claimFees()` simulation at the previous block; the positions page then shows zero fees and Claim disabled with "You have no fees to claim yet."
- [ ] **Step 5:** Record the exit's `gasUsed` (permit path); set `EXIT_GAS` to it rounded up to the next 50,000 plus 10%, update the expectations in `exit.test.ts` and `exit-preview.test.ts`, commit `fix(web): set the exit gas estimate from the measured transaction`.
- [ ] **Step 6:** Read-only checks with a keyless mock: Unisat mock (smart account) sees "Approve LP" then "Exit to MUSD"; mainnet (network switch) shows positions read-only with Claim disabled and "Mainnet actions open after launch. Reading only."; 360 px layouts of `/positions/`, the exit page, and both receipts; the header fits at 360 px. Stop the signer and the server; delete the signer's files.

---

### Task 11: Docs, preview, user QA, merge

**Files:** `PRODUCT_SPEC.md` (§16 F7 row → "Positions (LP): underlying, cost basis, claimable fees + Claim, exit" and F5 row gains "SP position + withdraw"; §11.5 note: `burn` pays pro rata of balances; §12 "Positions data": `eth_getLogs` ≤ 10,000 blocks and clamped to the head, fees computed from `index`/`supplyIndex`/`claimable` and checked against `claimFees()`; §16 "F7 done <date>: …"), `CLAUDE.md` (Positions (F7) notes: one snapshot with fee indexes, history scan and cache, LP permit domain `""`/`"1"`, generic stepper), F7 design doc (QA result).

- [ ] **Step 1:** Docs edits above (except §16 and the QA result), `npm test && npm run build`, `forge test`, commit `docs: record the F7 positions notes`.
- [ ] **Step 2:** `vercel deploy` preview; give the user the URL and checklist: MetaMask: `/positions/` → values shown, cost basis loads → Claim → receipt "Fees claimed" → back to positions (fees 0) → Exit to MUSD → 25% → Sign LP permit → Send → receipt "Exit confirmed" with "MUSD received"; Unisat: Exit shows "Approve LP" first.
- [ ] **Step 3:** After the user's pass: record the QA result and §16, commit `docs: record that F7 QA passed`, merge `--no-ff` into `main`, `npm test && npm run build` and `forge test` on `main`, push `main`, delete the branch.
