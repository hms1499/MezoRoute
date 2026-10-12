# F4 Borrow & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An EOA user with a Trove borrows MUSD and deposits it into the MUSD/BTC LP in one `borrowAndEnter` transaction (permit + borrow authorisation signatures), from a `mode=borrow` toggle on `/route/lp/`.

**Architecture:** Pure, unit-tested core in `lib/trove/{borrow,borrow-signature,hints}` and the F3 route modules extended with a `mode` (intent, steps, gate, preview, params, stepper). The F3 snapshot gains five reads (borrow nonce, system collateral/debt, CCR, Trove count). UI reuses F3's route, confirm, and receipt pages; `useEntryFlow` gains a `borrow` signature step and the `borrowAndEnter` send.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, wagmi 2.19.5, viem 2.57.2, `@mezo-org/passport` 0.17.2, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-12-f4-borrow-deploy-design.md` (read it first; chain facts verified 12 Oct 2026). F3's design and code are the base: `docs/superpowers/specs/2026-10-05-f3-lp-route-design.md`.

## Global Constraints

- Branch `feat/f4-borrow-deploy` in `/Users/vanhuy/Desktop/mezoroute`; no worktree. Run `git branch --show-current` before each commit; stage explicit paths; no `* 2*` iCloud duplicates in `git status`.
- Commit prefixes `feat(web):`, `fix(web):`, `test(web):`, `docs:`; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency changes. Addresses only from `network.addresses` / `network.executor`.
- All amounts and ratios are `bigint` (1e18 = 1 MUSD / 100%). Copy in English, never "guaranteed"/"risk-free"; pre-transaction values are "estimated".
- CR safety floor `CR_SAFETY_FLOOR` = 160% (`src/lib/trove/constants.ts`). Signature and transaction deadline: snapshot block timestamp + `DEADLINE_SECONDS` (600 s); a signature is used only with 60 s to spare.
- Borrow recipient is always the borrower (the pinned account). Borrow & Deploy only for `walletCapabilities(kind).borrowAndDeploy`.
- Never let `WagmiProvider` re-render (CLAUDE.md); new pages and hooks stay under the existing wallet tree.
- Run `npm` from `web/`. UI tasks also run `npm run build` (lint + type check). Never build while `npm run dev` runs.

## Review Focus

- **Max must never be blocked by the gate.** Borrowing exactly `borrowLimit` passes both the CR-floor and headroom checks; one wei more is blocked. Pinned in Task 5 ("borrowing exactly the limit is allowed; one wei more is blocked").
- **A borrow authorisation used elsewhere (nonce moved) must not be sent.** `useEntryFlow` compares the fresh `borrowNonce` with the signed nonce and throws `BlockedError(BORROW_USED)`. The decision is the pure `borrowAuthorisationState` (Task 2), pinned by its tests.
- **An expired borrow signature resets to the first signature step**, not only the permit. Pinned in Task 6 (stepper "signature-expired" with a borrow-only plan).
- **Recovery mode blocks borrowing** even when the CR would stay above the floor. Pinned in Task 5 (gate order) and Task 1 (`isRecoveryMode`).
- **Hint lookup failure must not block the send**; it falls back to zero hints. Pinned in Task 2 (`findHints` fallback).

---

### Task 1: Borrow maths (`lib/trove/borrow.ts`)

**Files:**
- Create: `web/src/lib/trove/borrow.ts`
- Test: `web/src/lib/trove/borrow.test.ts`

**Interfaces:**
- Consumes: `Trove`, `Protocol` from `@/lib/dashboard/snapshot`; `collateralRatio`, `borrowHeadroom` from `./health`; `WAD` from `@/lib/math`.
- Produces:
  - `NICR_PRECISION = 10n ** 20n`
  - `type SystemState = { coll: bigint; debt: bigint; ccr: bigint; troveCount: bigint }`
  - `type BorrowEffect = { amount: bigint; fee: bigint; newPrincipal: bigint; newDebt: bigint; newCr: bigint | null; newNicr: bigint }`
  - `borrowEffect(trove: Trove, price: bigint, protocol: Protocol, amount: bigint): BorrowEffect`
  - `borrowLimit(trove: Trove | null, price: bigint, protocol: Protocol, maxMusdIn: bigint): bigint`
  - `isRecoveryMode(system: SystemState, price: bigint): boolean`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/trove/borrow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "@/lib/dashboard/test-fixtures";
import { borrowEffect, borrowLimit, isRecoveryMode, type SystemState } from "./borrow";
import { CR_SAFETY_FLOOR } from "./constants";
import { borrowHeadroom } from "./health";

const protocol = { mcr: MCR, borrowingRate: BORROWING_RATE };

describe("borrowEffect", () => {
  it("adds the amount and the rounded-down 0.1% fee to debt and principal, as BorrowerOperations does", () => {
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 100n * ONE)).toEqual({
      amount: 100n * ONE,
      fee: 100_000_000_000_000_000n,
      newPrincipal: 2_161_960_000_000_000_000_000n,
      newDebt: 2_162_516_504_131_786_872_189n,
      newCr: 1_798_653_960_590_980_544n,
      // TroveManager.getNominalICR: collateral × 1e20 / principal (interest is not in the NICR).
      newNicr: 2_081_444_615_071_509n,
    });
  });

  it("rounds the fee down", () => {
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 999n).fee).toBe(0n);
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 1_000n).fee).toBe(1n);
  });
});

describe("borrowLimit", () => {
  it("is the fee-aware headroom, capped by the executor's maxMusdIn", () => {
    const headroom = borrowHeadroom(deployerTrove, FIXTURE_PRICE, protocol);
    expect(headroom).toBe(242_200_593_184_119_916_984n);
    expect(borrowLimit(deployerTrove, FIXTURE_PRICE, protocol, 1_000_000n * ONE)).toBe(headroom);
    expect(borrowLimit(deployerTrove, FIXTURE_PRICE, protocol, 100n * ONE)).toBe(100n * ONE);
    expect(borrowLimit(null, FIXTURE_PRICE, protocol, 1_000n * ONE)).toBe(0n);
  });

  it.each([
    ["capacity-bound", deployerTrove],
    ["floor-bound", { ...deployerTrove, maxBorrowingCapacity: 10_000n * ONE }],
  ])("keeps a %s Trove at or above the floor and within capacity when borrowing exactly the limit", (_name, trove) => {
    const limit = borrowLimit(trove, FIXTURE_PRICE, protocol, 1_000_000n * ONE);
    expect(limit > 0n).toBe(true);
    const effect = borrowEffect(trove, FIXTURE_PRICE, protocol, limit);
    expect(effect.newCr! >= CR_SAFETY_FLOOR).toBe(true);
    expect(effect.newDebt <= trove.maxBorrowingCapacity).toBe(true);
  });
});

describe("isRecoveryMode", () => {
  // Testnet on 12 Oct 2026: TCR ≈ 300% against a 150% CCR.
  const testnet: SystemState = {
    coll: 15_413_774_352_354_411_406_618n,
    debt: 428_873_804_402_699_388_378_829_611n,
    ccr: 1_500_000_000_000_000_000n,
    troveCount: 242n,
  };

  it("compares the system's collateral ratio with the CCR", () => {
    expect(isRecoveryMode(testnet, FIXTURE_PRICE)).toBe(false);
    expect(isRecoveryMode(testnet, 40_000n * ONE)).toBe(true);
  });

  it("is never on without system debt", () => {
    expect(isRecoveryMode({ ...testnet, debt: 0n }, 1n)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/trove/borrow.test.ts`
Expected: FAIL — `Cannot find module './borrow'`.

- [ ] **Step 3: Implement**

Create `web/src/lib/trove/borrow.ts`:

```ts
import type { Protocol, Trove } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";
import { borrowHeadroom, collateralRatio } from "./health";

/** LiquityMath.NICR_PRECISION: the nominal ICR that orders SortedTroves. */
export const NICR_PRECISION = 10n ** 20n;

/** System totals read with the LP route snapshot; recovery mode and hint trials come from them. */
export type SystemState = { coll: bigint; debt: bigint; ccr: bigint; troveCount: bigint };

export type BorrowEffect = {
  amount: bigint;
  fee: bigint; // borrowing fee, minted to the PCV and added to the debt
  newPrincipal: bigint;
  newDebt: bigint;
  newCr: bigint | null; // 1e18 = 100%
  newNicr: bigint; // collateral × 1e20 / principal, as TroveManager.getNominalICR
};

/**
 * What borrowing `amount` does to the Trove, with BorrowerOperations' rounding: the fee is
 * amount × borrowingRate / 1e18 rounded down, and debt and principal both grow by amount + fee.
 */
export function borrowEffect(trove: Trove, price: bigint, protocol: Protocol, amount: bigint): BorrowEffect {
  const fee = (amount * protocol.borrowingRate) / WAD;
  const newPrincipal = trove.principal + amount + fee;
  const newDebt = trove.debt + amount + fee;
  return {
    amount,
    fee,
    newPrincipal,
    newDebt,
    newCr: collateralRatio({ ...trove, debt: newDebt }, price),
    newNicr: (trove.collateral * NICR_PRECISION) / newPrincipal,
  };
}

/** The most the user may borrow and deploy: the safe headroom, capped by the executor's entry cap. */
export function borrowLimit(trove: Trove | null, price: bigint, protocol: Protocol, maxMusdIn: bigint): bigint {
  if (!trove) return 0n;
  const headroom = borrowHeadroom(trove, price, protocol);
  return headroom < maxMusdIn ? headroom : maxMusdIn;
}

/** TroveManager.checkRecoveryMode, computed locally: TCR = system collateral × price / system debt < CCR. */
export function isRecoveryMode(system: SystemState, price: bigint): boolean {
  if (system.debt === 0n) return false;
  return (system.coll * price) / system.debt < system.ccr;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/trove`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/trove/borrow.ts web/src/lib/trove/borrow.test.ts
git commit -m "feat(web): add the borrow effect, borrow limit, and recovery-mode maths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Borrow authorisation, hints, and their ABIs

**Files:**
- Modify: `web/src/lib/abi/musd.ts` (append four ABIs)
- Create: `web/src/lib/trove/borrow-signature.ts`, `web/src/lib/trove/hints.ts`
- Test: `web/src/lib/trove/borrow-signature.test.ts`, `web/src/lib/trove/hints.test.ts`

**Interfaces:**
- Consumes: `NetworkConfig`; `isqrt` from `@/lib/math`.
- Produces:
  - ABIs `borrowerOperationsSignaturesAbi`, `troveSystemAbi`, `hintHelpersAbi`, `sortedTrovesAbi`
  - `borrowDomain(network)`, `BORROW_TYPES`, `borrowTypedData(input: { network: NetworkConfig; borrower: Address; amount: bigint; nonce: bigint; deadline: bigint })`
  - `type BorrowAuthorisation = { amount: bigint; nonce: bigint; deadline: bigint; signature: Hex }`
  - `BORROW_MARGIN_SECONDS = 60n`, `borrowAuthorisationState(auth: BorrowAuthorisation, nowSeconds: bigint, chainNonce: bigint): "usable" | "expired" | "used"`
  - `type Hints = { upperHint: Address; lowerHint: Address; found: boolean }`, `ZERO_HINTS`, `hintTrials(troveCount: bigint): bigint`, `type HintRead = (call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] }) => Promise<unknown>`, `findHints(read: HintRead, input: { network: NetworkConfig; nicr: bigint; troveCount: bigint; seed: bigint }): Promise<Hints>`

- [ ] **Step 1: Add the ABIs**

Append to `web/src/lib/abi/musd.ts`:

```ts
/** BorrowerOperationsSignatures: the EIP-712 nonce of a borrower (spec §4). */
export const borrowerOperationsSignaturesAbi = parseAbi(["function getNonce(address user) view returns (uint256)"]);

/** System totals for recovery mode (TCR = coll × price / debt < CCR) and the hint trial count. */
export const troveSystemAbi = parseAbi([
  "function getEntireSystemColl() view returns (uint256)",
  "function getEntireSystemDebt() view returns (uint256)",
  "function CCR() view returns (uint256)",
  "function getTroveOwnersCount() view returns (uint256)",
]);

export const hintHelpersAbi = parseAbi([
  "function getApproxHint(uint256 CR, uint256 numTrials, uint256 inputRandomSeed) view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)",
]);

export const sortedTrovesAbi = parseAbi([
  "function findInsertPosition(uint256 NICR, address prevId, address nextId) view returns (address, address)",
]);
```

- [ ] **Step 2: Write the failing tests**

Create `web/src/lib/trove/borrow-signature.test.ts`:

```ts
import { recoverTypedDataAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { borrowAuthorisationState, borrowTypedData } from "./borrow-signature";

const DEPLOYER = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

describe("borrowTypedData", () => {
  it("recovers the live 2 Oct 2026 borrow authorisation to its signer (tx 0xdebe…6259)", async () => {
    // BorrowerOperationsSignatures accepted this signature on testnet: nonce 2, 20 MUSD.
    const typedData = borrowTypedData({
      network: networks.testnet,
      borrower: DEPLOYER,
      amount: 20_000_000_000_000_000_000n,
      nonce: 2n,
      deadline: 1_790_904_394n,
    });
    expect(typedData.message.recipient).toBe(DEPLOYER);
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature:
        "0x7707dcf3e84ad2832f169f1a60bf87ed3b295de9da19019fa37acc222e176d4642385f31e362c00d2650159b4132137b799565248b607956e709d594826453b81c",
    });
    expect(signer).toBe(DEPLOYER);
  });
});

describe("borrowAuthorisationState", () => {
  const auth = { amount: 5n, nonce: 7n, deadline: 1_000n, signature: "0x00" } as const;

  it("is usable with a minute to spare and an unchanged nonce", () => {
    expect(borrowAuthorisationState(auth, 939n, 7n)).toBe("usable");
  });

  it("expires inside the last minute", () => {
    expect(borrowAuthorisationState(auth, 940n, 7n)).toBe("expired");
  });

  it("is used once the borrower's nonce has moved", () => {
    expect(borrowAuthorisationState(auth, 100n, 8n)).toBe("used");
  });
});
```

Create `web/src/lib/trove/hints.test.ts`:

```ts
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { findHints, hintTrials, type HintRead } from "./hints";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

describe("hintTrials", () => {
  it("is 15 × ⌈√n⌉", () => {
    expect(hintTrials(242n)).toBe(240n);
    expect(hintTrials(225n)).toBe(225n);
    expect(hintTrials(1n)).toBe(15n);
    expect(hintTrials(0n)).toBe(0n);
  });
});

describe("findHints", () => {
  const input = { network: networks.testnet, nicr: 123n, troveCount: 242n, seed: 9n };

  it("asks HintHelpers for an approximate hint, then SortedTroves for the exact position", async () => {
    const calls: { functionName: string; args: readonly unknown[]; address: string }[] = [];
    const read: HintRead = async (call) => {
      calls.push(call);
      return call.functionName === "getApproxHint" ? [A, 0n, 1n] : [B, C];
    };
    await expect(findHints(read, input)).resolves.toEqual({ upperHint: B, lowerHint: C, found: true });
    expect(calls).toEqual([
      expect.objectContaining({ address: networks.testnet.addresses.hintHelpers, functionName: "getApproxHint", args: [123n, 240n, 9n] }),
      expect.objectContaining({ address: networks.testnet.addresses.sortedTroves, functionName: "findInsertPosition", args: [123n, A, A] }),
    ]);
  });

  it("falls back to zero hints when a read fails, so the send still goes through", async () => {
    const read: HintRead = async () => {
      throw new Error("RPC down");
    };
    await expect(findHints(read, input)).resolves.toEqual({ upperHint: zeroAddress, lowerHint: zeroAddress, found: false });
  });

  it("needs no reads without Troves", async () => {
    const read: HintRead = async () => {
      throw new Error("should not be called");
    };
    await expect(findHints(read, { ...input, troveCount: 0n })).resolves.toMatchObject({ found: false });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd web && npx vitest run src/lib/trove/borrow-signature.test.ts src/lib/trove/hints.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

Create `web/src/lib/trove/borrow-signature.ts`:

```ts
import type { Address, Hex } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";

/** BorrowerOperationsSignatures' EIP-712 domain (verified on testnet, 30 Sep and 2 Oct 2026). */
export function borrowDomain(network: NetworkConfig) {
  return {
    name: "BorrowerOperationsSignatures",
    version: "1",
    chainId: network.chainId,
    verifyingContract: network.addresses.borrowerOperationsSignatures,
  } as const;
}

export const BORROW_TYPES = {
  WithdrawMUSD: [
    { name: "amount", type: "uint256" },
    { name: "borrower", type: "address" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** The borrow authorisation; the recipient is always the borrower (spec §11.4). */
export function borrowTypedData(input: {
  network: NetworkConfig;
  borrower: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: borrowDomain(input.network),
    types: BORROW_TYPES,
    primaryType: "WithdrawMUSD" as const,
    message: {
      amount: input.amount,
      borrower: input.borrower,
      recipient: input.borrower,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  };
}

export type BorrowAuthorisation = { amount: bigint; nonce: bigint; deadline: bigint; signature: Hex };

/** Like a permit, a borrow authorisation is sent only with a minute to spare. */
export const BORROW_MARGIN_SECONDS = 60n;

/**
 * Whether a signed authorisation can still be sent: "used" when the borrower's nonce has moved (it
 * was submitted elsewhere, so the MUSD is already in the wallet), "expired" inside the last minute.
 */
export function borrowAuthorisationState(
  auth: BorrowAuthorisation,
  nowSeconds: bigint,
  chainNonce: bigint,
): "usable" | "expired" | "used" {
  if (chainNonce !== auth.nonce) return "used";
  if (nowSeconds + BORROW_MARGIN_SECONDS >= auth.deadline) return "expired";
  return "usable";
}
```

Create `web/src/lib/trove/hints.ts`:

```ts
import { zeroAddress, type Abi, type Address } from "viem";
import { hintHelpersAbi, sortedTrovesAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { isqrt } from "@/lib/math";

export type Hints = { upperHint: Address; lowerHint: Address; found: boolean };

/** Valid but costly: SortedTroves then walks the list from its head (≈2.18M gas on testnet, 2 Oct 2026). */
export const ZERO_HINTS: Hints = { upperHint: zeroAddress, lowerHint: zeroAddress, found: false };

/** Liquity's guidance for getApproxHint: 15 × √n trials, rounded up. */
export function hintTrials(troveCount: bigint): bigint {
  if (troveCount === 0n) return 0n;
  const root = isqrt(troveCount);
  return 15n * (root * root === troveCount ? root : root + 1n);
}

export type HintRead = (call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] }) => Promise<unknown>;

/** The Trove's insert position for its new NICR; zero hints on any failure (the send must not depend on it). */
export async function findHints(
  read: HintRead,
  input: { network: NetworkConfig; nicr: bigint; troveCount: bigint; seed: bigint },
): Promise<Hints> {
  if (input.troveCount === 0n) return ZERO_HINTS;
  const { hintHelpers, sortedTroves } = input.network.addresses;
  try {
    const [approx] = (await read({
      address: hintHelpers,
      abi: hintHelpersAbi,
      functionName: "getApproxHint",
      args: [input.nicr, hintTrials(input.troveCount), input.seed],
    })) as readonly [Address, bigint, bigint];
    const [upperHint, lowerHint] = (await read({
      address: sortedTroves,
      abi: sortedTrovesAbi,
      functionName: "findInsertPosition",
      args: [input.nicr, approx, approx],
    })) as readonly [Address, Address];
    return { upperHint, lowerHint, found: true };
  } catch {
    return ZERO_HINTS;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/trove && npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/abi/musd.ts web/src/lib/trove/borrow-signature.ts web/src/lib/trove/borrow-signature.test.ts web/src/lib/trove/hints.ts web/src/lib/trove/hints.test.ts
git commit -m "feat(web): add the borrow authorisation typed data and Trove hints

The typed-data test recovers the live 2 Oct 2026 borrowAndEnter signature to its signer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Snapshot reads for borrowing

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/snapshot.ts`, `web/src/lib/routes/musd-btc-lp/test-fixtures.ts`
- Test: `web/src/lib/routes/musd-btc-lp/snapshot.test.ts` (update)

**Interfaces:**
- Consumes: `borrowerOperationsSignaturesAbi`, `troveSystemAbi` (Task 2); `SystemState` (Task 1).
- Produces: `LpRouteSnapshot` gains `borrowNonce: bigint; system: SystemState`; `lpRouteContracts` makes 24 calls; fixture `TESTNET_SYSTEM: SystemState`.

- [ ] **Step 1: Update the tests first**

In `web/src/lib/routes/musd-btc-lp/snapshot.test.ts`:
1. Replace the `results` tail line `return [...dashboard, 4n, 7n * ONE, 3n, 10n, 1_000_000n * ONE, 15936716n, 1_759_600_000n];` with:

```ts
  return [
    ...dashboard,
    4n,
    7n * ONE,
    3n,
    10n,
    1_000_000n * ONE,
    15936716n,
    1_759_600_000n,
    2n,
    15_413n * ONE,
    428_873_804n * ONE,
    1_500_000_000_000_000_000n,
    242n,
  ];
```

2. Change `expect(calls).toHaveLength(DASHBOARD_READS + 7);` to `expect(calls).toHaveLength(DASHBOARD_READS + 12);`.
3. In "parses the LP-route reads on testnet", add to the `toMatchObject` object: `borrowNonce: 2n, system: { coll: 15_413n * ONE, debt: 428_873_804n * ONE, ccr: 1_500_000_000_000_000_000n, troveCount: 242n },`.
4. Add a test inside `describe("lpRouteContracts")`:

```ts
  it("reads the borrower's BOS nonce for the account", () => {
    const calls = lpRouteContracts(networks.testnet, EXECUTOR, ACCOUNT);
    const nonce = calls.find((call) => call.functionName === "getNonce");
    expect(nonce?.address).toBe(networks.testnet.addresses.borrowerOperationsSignatures);
    expect(nonce && "args" in nonce && nonce.args).toEqual([ACCOUNT]);
  });
```

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp/snapshot.test.ts`
Expected: FAIL (length 19 ≠ 24; no `borrowNonce`).

- [ ] **Step 2: Implement**

In `web/src/lib/routes/musd-btc-lp/snapshot.ts`:
1. Imports: add `import { borrowerOperationsSignaturesAbi, musdPermitAbi, troveSystemAbi } from "@/lib/abi/musd";` (replacing the `musdPermitAbi` import) and `import type { SystemState } from "@/lib/trove/borrow";`.
2. Add to `LpRouteSnapshot` after `blockTimestamp`:

```ts
  borrowNonce: bigint; // BorrowerOperationsSignatures nonce of the account
  system: SystemState; // recovery mode and hint trials
```

3. Append to `LpRouteTail`: `borrowNonce: bigint, systemColl: bigint, systemDebt: bigint, ccr: bigint, troveCount: bigint,`.
4. Append to the `lpRouteContracts` array (after the `getCurrentBlockTimestamp` call):

```ts
    { chainId, address: a.borrowerOperationsSignatures, abi: borrowerOperationsSignaturesAbi, functionName: "getNonce", args: [account] },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getEntireSystemColl" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getEntireSystemDebt" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "CCR" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getTroveOwnersCount" },
```

5. In `parseLpRouteSnapshot`, destructure the five new tail values (`borrowNonce, systemColl, systemDebt, ccr, troveCount`) and add to the returned object: `borrowNonce, system: { coll: systemColl, debt: systemDebt, ccr, troveCount },`.

In `web/src/lib/routes/musd-btc-lp/test-fixtures.ts`, add `import type { SystemState } from "@/lib/trove/borrow";`, the constant

```ts
/** Testnet system totals on 12 Oct 2026 (TCR ≈ 300%). */
export const TESTNET_SYSTEM: SystemState = {
  coll: 15_413_774_352_354_411_406_618n,
  debt: 428_873_804_402_699_388_378_829_611n,
  ccr: 1_500_000_000_000_000_000n,
  troveCount: 242n,
};
```

and `borrowNonce: 0n, system: TESTNET_SYSTEM,` in `lpRouteSnapshotWith` before `...overrides`.

- [ ] **Step 3: Run the tests**

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp && npx tsc --noEmit -p .`
Expected: PASS (including the encode-every-call test); no type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/routes/musd-btc-lp/snapshot.ts web/src/lib/routes/musd-btc-lp/snapshot.test.ts web/src/lib/routes/musd-btc-lp/test-fixtures.ts
git commit -m "feat(web): read the borrow nonce and system totals in the LP route snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Borrow outcomes, revert strings, and the Deposit MUSD recovery

**Files:**
- Modify: `web/src/lib/errors/types.ts`, `web/src/lib/errors/outcomes.ts`, `web/src/lib/errors/revert-strings.ts`, `web/src/components/ErrorToast.tsx`
- Test: `web/src/lib/errors/revert-strings.test.ts` (create)

**Interfaces:**
- Produces: outcomes `SMART_ACCOUNT_BORROW`, `NO_TROVE`, `RECOVERY_MODE`, `CR_FLOOR`, `ABOVE_HEADROOM`, `BORROW_USED`, `SIGNATURE_INVALID`; `Recovery` gains `"use-deposit"`; `RecoveryHandlers` gains `useDeposit?: () => void`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/errors/revert-strings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { revertStringOutcome } from "./revert-strings";

describe("revertStringOutcome: BorrowerOperations and its signatures (F4)", () => {
  it.each([
    ["BorrowerOperationsSignatures: Invalid signature", "signature-invalid"],
    ["Signature expired", "permit-expired"],
    ["BorrowerOps: An operation that would result in ICR < MCR is not permitted", "cr-floor"],
    ["BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted", "above-headroom"],
    ["BorrowerOps: An operation that would result in TCR < CCR is not permitted", "recovery-mode"],
    ["BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode", "recovery-mode"],
    ["BorrowerOps: Trove does not exist or is closed", "no-trove"],
  ])("maps %j", (reason, kind) => {
    expect(revertStringOutcome(reason)?.kind).toBe(kind);
  });

  it("keeps the F1 rows", () => {
    expect(revertStringOutcome("ERC20: insufficient allowance")?.kind).toBe("allowance");
  });
});
```

Run: `cd web && npx vitest run src/lib/errors/revert-strings.test.ts`
Expected: FAIL (the F4 rows return undefined kinds).

- [ ] **Step 2: Implement**

In `web/src/lib/errors/types.ts`: add `| "use-deposit"` to `Recovery` (after `"view-transaction"`, moving the `;`), and add to `ErrorKind` after `"permit-expired"`:

```ts
  | "smart-account-borrow"
  | "no-trove"
  | "recovery-mode"
  | "cr-floor"
  | "above-headroom"
  | "borrow-used"
  | "signature-invalid"
```

In `web/src/lib/errors/outcomes.ts`, add after `PERMIT_EXPIRED`:

```ts
export const SMART_ACCOUNT_BORROW: Outcome = {
  kind: "smart-account-borrow",
  message: "Borrow & Deploy needs a standard wallet signature.",
  recovery: [],
};

export const NO_TROVE: Outcome = {
  kind: "no-trove",
  message: "You need an open Trove to borrow. Open one in the Mezo app.",
  recovery: [],
};

export const RECOVERY_MODE: Outcome = {
  kind: "recovery-mode",
  message: "Borrowing is paused while Mezo is in Recovery Mode.",
  recovery: [],
};

export const CR_FLOOR: Outcome = {
  kind: "cr-floor",
  message: "This borrow would leave your Trove too close to liquidation.",
  recovery: ["reduce-amount"],
};

export const ABOVE_HEADROOM: Outcome = {
  kind: "above-headroom",
  message: "Amount exceeds what your Trove can safely borrow.",
  recovery: ["reduce-amount"],
};

export const BORROW_USED: Outcome = {
  kind: "borrow-used",
  message: "Your borrow authorisation was already used; the MUSD is in your wallet.",
  recovery: ["use-deposit"],
};

export const SIGNATURE_INVALID: Outcome = {
  kind: "signature-invalid",
  message: "Your borrow authorisation is no longer valid. Sign again.",
  recovery: ["retry"],
};
```

Replace the import and the array in `web/src/lib/errors/revert-strings.ts`:

```ts
import {
  ABOVE_HEADROOM,
  ALLOWANCE,
  CR_FLOOR,
  INSUFFICIENT_BALANCE,
  NO_TROVE,
  PERMIT_EXPIRED,
  PRICE_UNAVAILABLE,
  RECOVERY_MODE,
  SIGNATURE_INVALID,
} from "./outcomes";
```

```ts
export const REVERT_STRINGS: readonly { match: RegExp; outcome: Outcome }[] = [
  { match: /ERC20: insufficient allowance/i, outcome: ALLOWANCE },
  { match: /ERC20: transfer amount exceeds balance/i, outcome: INSUFFICIENT_BALANCE },
  // MUSD PriceFeed.fetchPrice(): every Trove read and borrow needs a fresh price.
  { match: /PriceFeed: Oracle is stale/i, outcome: PRICE_UNAVAILABLE },
  // BorrowerOperationsSignatures and BorrowerOperations (Borrow & Deploy, F4).
  { match: /BorrowerOperationsSignatures: Invalid signature/i, outcome: SIGNATURE_INVALID },
  { match: /\bSignature expired\b/i, outcome: PERMIT_EXPIRED },
  { match: /would result in ICR < MCR/i, outcome: CR_FLOOR },
  { match: /exceeds maxBorrowingCapacity/i, outcome: ABOVE_HEADROOM },
  { match: /TCR < CCR|in Recovery Mode/i, outcome: RECOVERY_MODE },
  { match: /Trove does not exist or is closed/i, outcome: NO_TROVE },
];
```

Update the doc comment above it to: "Known `Error(string)` reverts, matched against the decoded reason or, without revert data, the error text. F5 adds the Stability Pool rows."

In `web/src/components/ErrorToast.tsx`: change `RecoveryHandlers` to `{ retry?: () => void; refreshQuote?: () => void; reduceAmount?: () => void; useDeposit?: () => void }`; add `"use-deposit": "Deposit MUSD",` to `LABELS`; and add to the `switch` in `action`:

```ts
      case "use-deposit":
        return thenDismiss(handlers.useDeposit);
```

- [ ] **Step 3: Run the tests**

Run: `cd web && npx vitest run src/lib/errors && npx tsc --noEmit -p .`
Expected: PASS (all decoder tests too); no type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/errors/types.ts web/src/lib/errors/outcomes.ts web/src/lib/errors/revert-strings.ts web/src/lib/errors/revert-strings.test.ts web/src/components/ErrorToast.tsx
git commit -m "feat(web): decode borrow reverts and add the Borrow & Deploy outcomes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mode in intent, steps, gas, gate, and preview

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/intent.ts`, `steps.ts`, `gate.ts`, `after-entry.ts`, `preview.ts`; `web/src/lib/quote/gas.ts`
- Test: update `intent.test.ts`, `steps.test.ts`, `gate.test.ts`, `preview.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces:
  - `type EntryMode = "deposit" | "borrow"`; `EntryIntent` gains `mode: EntryMode`; `entryQuery(intent: { amount: string; slippageBps: SlippageBps; mode?: EntryMode })`
  - `StepKind = "permit" | "approve" | "borrow" | "enter"`; `entrySteps(kind, allowance, musdIn, mode: EntryMode = "deposit")`
  - `BORROW_ENTER_GAS`; `entryGasUnits(input: { approve: boolean; smartAccount: boolean; borrow?: boolean })`
  - `type BorrowGate = { canSign: boolean; hasTrove: boolean; recoveryMode: boolean; limit: bigint; newCr: bigint | null }`; `EntryGateInput.borrow?: BorrowGate | null`; reasons `"smart-account-borrow" | "no-trove" | "recovery-mode" | "cr-floor" | "above-headroom"`
  - `afterBorrowEntry(snapshot: DashboardSnapshot, quote: EntryQuote, effect: BorrowEffect): DashboardSnapshot`
  - `type BorrowPreview = { trove: Trove | null; limit: bigint; recoveryMode: boolean; effect: BorrowEffect | null }`; `EntryPreview.borrow: BorrowPreview | null`

- [ ] **Step 1: Update and add the tests first**

`intent.test.ts`: in the first three `toEqual`/`toMatchObject` expectations that list the whole intent, add `mode: "deposit"` (`{ amount: "12.5", musdIn: …, slippageBps: 50n, mode: "deposit" }`, `{ amount: "", musdIn: null, slippageBps: 100n, mode: "deposit" }`, and the round-trip's `{ amount: "100", musdIn: 100n * ONE, slippageBps: 200n, mode: "deposit" }`). Add:

```ts
describe("entry mode", () => {
  it("reads borrow mode and round-trips it; anything else is a deposit", () => {
    const query = entryQuery({ amount: "5", slippageBps: 100n, mode: "borrow" });
    expect(query).toBe("?amount=5&slippage=1&mode=borrow");
    expect(parseEntryIntent(new URLSearchParams(query)).mode).toBe("borrow");
    expect(parseEntryIntent(new URLSearchParams("mode=lever")).mode).toBe("deposit");
    expect(entryQuery({ amount: "5", slippageBps: 100n, mode: "deposit" })).toBe("?amount=5&slippage=1");
  });
});
```

`steps.test.ts`, add:

```ts
describe("entrySteps in borrow mode", () => {
  it("signs a permit and the borrow authorisation, then sends", () => {
    expect(entrySteps("eoa", 0n, 5n, "borrow")).toEqual(["permit", "borrow", "enter"]);
  });

  it("skips the permit when the allowance covers the amount", () => {
    expect(entrySteps("eoa", 5n, 5n, "borrow")).toEqual(["borrow", "enter"]);
  });
});
```

`gate.test.ts`: add `import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";` and:

```ts
describe("entryBlock in borrow mode", () => {
  const borrow = { canSign: true, hasTrove: true, recoveryMode: false, limit: 200n * ONE, newCr: CR_SAFETY_FLOOR };
  const borrowInput = (overrides: Partial<EntryGateInput> = {}) => input({ walletMusd: 0n, borrow, ...overrides });

  it("lets a borrow through without wallet MUSD", () => {
    expect(entryBlock(borrowInput())).toBeNull();
  });

  it.each([
    ["smart-account-borrow", { ...borrow, canSign: false }],
    ["no-trove", { ...borrow, hasTrove: false }],
    ["recovery-mode", { ...borrow, recoveryMode: true }],
  ])("blocks %s before any amount check", (reason, gate) => {
    expect(entryBlock(borrowInput({ borrow: gate, musdIn: null, quote: null }))?.reason).toBe(reason);
  });

  it("blocks a CR below the floor, then an amount above the limit", () => {
    expect(entryBlock(borrowInput({ borrow: { ...borrow, newCr: CR_SAFETY_FLOOR - 1n } }))).toMatchObject({
      reason: "cr-floor",
      outcome: { message: "This borrow would leave your Trove too close to liquidation." },
    });
    expect(entryBlock(borrowInput({ borrow: { ...borrow, limit: 100n * ONE - 1n } }))?.reason).toBe("above-headroom");
    expect(entryBlock(borrowInput({ borrow: { ...borrow, limit: 100n * ONE } }))).toBeNull();
  });
});
```

`preview.test.ts`: add imports `import { formatUnits } from "viem";`, `import { deployerTrove, snapshotWith } from "@/lib/dashboard/test-fixtures";`, `import { TESTNET_POOL } from "./test-fixtures";` (merge with the existing `./test-fixtures` import), and:

```ts
describe("entryPreview in borrow mode", () => {
  const dashboard = snapshotWith({
    trove: deployerTrove,
    musd: 3n * ONE,
    lp: { balance: 0n, totalSupply: TESTNET_POOL.totalSupply, reserveMusd: TESTNET_POOL.reserveMusd, reserveBtc: TESTNET_POOL.reserveBtc },
  });
  const data = lpRouteDataWith({ snapshot: lpRouteSnapshotWith({ dashboard }) });
  const borrowPreview = (query: string, overrides: Partial<Parameters<typeof entryPreview>[0]> = {}) =>
    preview(`${query}&mode=borrow`, { data, ...overrides });

  it("plans permit → borrow → send, adds the borrow to the Trove, and keeps the wallet MUSD", () => {
    const result = borrowPreview("amount=100");
    expect(result.steps).toEqual(["permit", "borrow", "enter"]);
    expect(result.gasUnits).toBe(2_200_000n);
    expect(result.borrow?.effect?.fee).toBe(100_000_000_000_000_000n);
    expect(result.after?.trove?.debt).toBe(result.borrow?.effect?.newDebt);
    expect(result.after?.musd).toBe(3n * ONE + result.quote!.musdRefund);
    expect(result.block).toBeNull();
  });

  it("allows borrowing exactly the limit and blocks one wei more", () => {
    const limit = borrowPreview("amount=1").borrow!.limit;
    expect(borrowPreview(`amount=${formatUnits(limit, 18)}`).block).toBeNull();
    expect(borrowPreview(`amount=${formatUnits(limit + 1n, 18)}`).block?.reason).toBe("above-headroom");
  });

  it("blocks a smart account", () => {
    expect(borrowPreview("amount=1", { walletKind: "smart-account" }).block?.reason).toBe("smart-account-borrow");
  });

  it("blocks without a Trove and shows no after-state", () => {
    const noTrove = lpRouteDataWith({ snapshot: lpRouteSnapshotWith({ dashboard: { ...dashboard, trove: null } }) });
    const result = borrowPreview("amount=1", { data: noTrove });
    expect(result.block?.reason).toBe("no-trove");
    expect(result.after).toBeNull();
  });
});
```

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp`
Expected: FAIL (no `mode`, no borrow steps, no `borrow` gate input, no `borrow` preview).

- [ ] **Step 2: Implement**

`intent.ts` — replace the type and both functions:

```ts
export type EntryMode = "deposit" | "borrow";

/** What the user asked for; the only state the LP pages pass between them (in the URL). */
export type EntryIntent = { amount: string; musdIn: bigint | null; slippageBps: SlippageBps; mode: EntryMode };

export function parseEntryIntent(params: { get(name: string): string | null }): EntryIntent {
  const amount = params.get("amount") ?? "";
  const slippage = params.get("slippage") ?? "";
  return {
    amount,
    musdIn: parseMusdAmount(amount),
    slippageBps: Object.hasOwn(SLIPPAGE_BY_PARAM, slippage) ? SLIPPAGE_BY_PARAM[slippage] : DEFAULT_SLIPPAGE,
    mode: params.get("mode") === "borrow" ? "borrow" : "deposit",
  };
}

/** The query both LP pages share: the user's inputs only, never quote values. */
export function entryQuery(intent: { amount: string; slippageBps: SlippageBps; mode?: EntryMode }): string {
  const query = new URLSearchParams();
  if (intent.amount) query.set("amount", intent.amount);
  query.set("slippage", PARAM_BY_SLIPPAGE[intent.slippageBps.toString()]);
  if (intent.mode === "borrow") query.set("mode", "borrow");
  return `?${query.toString()}`;
}
```

`steps.ts` — replace the body:

```ts
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import type { EntryMode } from "./intent";
import { needsApproval } from "./params";

export type StepKind = "permit" | "approve" | "borrow" | "enter";

/**
 * EOA: a MUSD permit; smart account or unknown kind: an exact approval (FR-06, FR-23); nothing when
 * the allowance already covers the amount. Borrow mode adds the borrow authorisation before sending.
 */
export function entrySteps(kind: WalletKind, allowance: bigint, musdIn: bigint, mode: EntryMode = "deposit"): StepKind[] {
  const authorise: StepKind[] = !needsApproval(allowance, musdIn)
    ? []
    : walletCapabilities(kind).permit
      ? ["permit"]
      : ["approve"];
  return mode === "borrow" ? [...authorise, "borrow", "enter"] : [...authorise, "enter"];
}
```

`web/src/lib/quote/gas.ts` — add after `ENTER_GAS` and replace `entryGasUnits`:

```ts
/** `borrowAndEnter`; provisional until F4 QA measures it with hints (zero hints: 2,178,863 on 2 Oct 2026). */
export const BORROW_ENTER_GAS = 2_200_000n;
```

```ts
/** Estimated gas units for the whole entry flow, for the preview's network-fee line. */
export function entryGasUnits(input: { approve: boolean; smartAccount: boolean; borrow?: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = (input.borrow ? BORROW_ENTER_GAS : ENTER_GAS) + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
```

`gate.ts`:
1. Imports: add `ABOVE_HEADROOM, CR_FLOOR, NO_TROVE, RECOVERY_MODE, SMART_ACCOUNT_BORROW` to the outcomes import, and `import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";`.
2. Add before `EntryGateInput`:

```ts
/** Borrow & Deploy's extra inputs; absent in deposit mode. `limit` is `borrowLimit` (headroom and cap). */
export type BorrowGate = { canSign: boolean; hasTrove: boolean; recoveryMode: boolean; limit: bigint; newCr: bigint | null };
```

3. Add `borrow?: BorrowGate | null;` as the last field of `EntryGateInput`.
4. Add to `EntryBlockReason`: `| "smart-account-borrow" | "no-trove" | "recovery-mode" | "cr-floor" | "above-headroom"`.
5. Replace the body of `entryBlock` from the `wrong-network` line through the `above-cap` line with:

```ts
  if (writeBlocker(network, input.walletChainId) === "wrong-network") return block("wrong-network", wrongNetwork(network));
  const borrow = input.borrow ?? null;
  if (borrow && !borrow.canSign) return block("smart-account-borrow", SMART_ACCOUNT_BORROW);
  if (borrow && !borrow.hasTrove) return block("no-trove", NO_TROVE);
  if (borrow?.recoveryMode) return block("recovery-mode", RECOVERY_MODE);
  if (input.musdIn === null) return block("zero", null);
  if (!borrow && input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
  if (input.musdIn > input.maxMusdIn) return block("above-cap", aboveCap(network));
  if (borrow && borrow.newCr !== null && borrow.newCr < CR_SAFETY_FLOOR) return block("cr-floor", CR_FLOOR);
  if (borrow && input.musdIn > borrow.limit) return block("above-headroom", ABOVE_HEADROOM);
```

`after-entry.ts` — add (with `import type { BorrowEffect } from "@/lib/trove/borrow";`):

```ts
/**
 * After Borrow & Deploy: the Trove carries the new debt and principal, the borrowed MUSD went into
 * the pool (the wallet only gains the MUSD refund), and the LP is as after a plain entry.
 */
export function afterBorrowEntry(snapshot: DashboardSnapshot, quote: EntryQuote, effect: BorrowEffect): DashboardSnapshot {
  const entered = afterEntry(snapshot, quote);
  return {
    ...entered,
    musd: snapshot.musd + quote.musdRefund,
    trove: snapshot.trove && { ...snapshot.trove, principal: effect.newPrincipal, debt: effect.newDebt },
  };
}
```

`preview.ts` — replace the whole file:

```ts
import type { NetworkConfig } from "@/lib/config/networks";
import type { DashboardSnapshot, Trove } from "@/lib/dashboard/snapshot";
import { lacksGas } from "@/lib/dashboard/readiness";
import { entryMinimums, quoteEntry, type EntryMinimums, type EntryQuote } from "@/lib/quote/entry";
import { entryGasUnits } from "@/lib/quote/gas";
import { borrowEffect, borrowLimit, isRecoveryMode, type BorrowEffect } from "@/lib/trove/borrow";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import { afterBorrowEntry, afterEntry } from "./after-entry";
import { entryBlock, type EntryBlock } from "./gate";
import type { EntryIntent } from "./intent";
import { DEADLINE_SECONDS } from "./params";
import type { LpRouteData } from "./snapshot";
import { entrySteps, type StepKind } from "./steps";

/** Borrow & Deploy's part of the preview; null in deposit mode. */
export type BorrowPreview = { trove: Trove | null; limit: bigint; recoveryMode: boolean; effect: BorrowEffect | null };

export type EntryPreview = {
  quote: EntryQuote | null;
  minimums: EntryMinimums | null;
  steps: StepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  after: DashboardSnapshot | null;
  borrow: BorrowPreview | null;
  block: EntryBlock | null;
};

/** Everything both LP pages show and gate on, computed from one snapshot. */
export function entryPreview(input: {
  network: NetworkConfig;
  data: LpRouteData;
  intent: EntryIntent;
  walletKind: WalletKind;
  walletChainId: number | undefined;
  now: number;
}): EntryPreview {
  const { network, data, intent, walletKind } = input;
  const { snapshot } = data;
  const { dashboard } = snapshot;
  const borrowing = intent.mode === "borrow";
  const quote = intent.musdIn === null ? null : quoteEntry(snapshot.pool, intent.musdIn, snapshot.executorFeeBps);
  const steps = entrySteps(walletKind, snapshot.allowance, intent.musdIn ?? 0n, intent.mode);
  const gasUnits = entryGasUnits({
    approve: steps.includes("approve"),
    smartAccount: walletKind === "smart-account",
    borrow: borrowing,
  });
  const borrow: BorrowPreview | null = borrowing
    ? {
        trove: dashboard.trove,
        limit: borrowLimit(dashboard.trove, dashboard.price, dashboard.protocol, snapshot.maxMusdIn),
        recoveryMode: isRecoveryMode(snapshot.system, dashboard.price),
        effect:
          dashboard.trove && intent.musdIn !== null
            ? borrowEffect(dashboard.trove, dashboard.price, dashboard.protocol, intent.musdIn)
            : null,
      }
    : null;
  const after = !quote
    ? null
    : borrow
      ? borrow.effect && afterBorrowEntry(dashboard, quote, borrow.effect)
      : afterEntry(dashboard, quote);
  return {
    quote,
    minimums: quote && entryMinimums(quote, intent.slippageBps),
    steps,
    gasUnits,
    gasCost: data.gasPrice === undefined ? null : gasUnits * data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    after,
    borrow,
    block: entryBlock({
      network,
      walletChainId: input.walletChainId,
      chainFeeBps: snapshot.executorFeeBps,
      musdIn: intent.musdIn,
      walletMusd: dashboard.musd,
      maxMusdIn: snapshot.maxMusdIn,
      quote,
      lacksGas: lacksGas(data.gasBalance, data.gasPrice),
      quoteAgeMs: input.now - data.fetchedAt,
      borrow: borrow && {
        canSign: walletCapabilities(walletKind).borrowAndDeploy,
        hasTrove: borrow.trove !== null,
        recoveryMode: borrow.recoveryMode,
        limit: borrow.limit,
        newCr: borrow.effect?.newCr ?? null,
      },
    }),
  };
}
```

- [ ] **Step 3: Run the tests**

Run: `cd web && npx vitest run src/lib && npx tsc --noEmit -p .`
Expected: PASS; no type errors (the route and confirm pages still compile: `entrySteps` and `entryQuery` keep defaults).

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/routes/musd-btc-lp/intent.ts web/src/lib/routes/musd-btc-lp/intent.test.ts web/src/lib/routes/musd-btc-lp/steps.ts web/src/lib/routes/musd-btc-lp/steps.test.ts web/src/lib/routes/musd-btc-lp/gate.ts web/src/lib/routes/musd-btc-lp/gate.test.ts web/src/lib/routes/musd-btc-lp/after-entry.ts web/src/lib/routes/musd-btc-lp/preview.ts web/src/lib/routes/musd-btc-lp/preview.test.ts web/src/lib/quote/gas.ts
git commit -m "feat(web): preview and gate Borrow & Deploy in the LP route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `borrowAndEnter` params and the stepper's borrow signature

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/params.ts`, `web/src/lib/tx/stepper.ts`
- Test: `web/src/lib/routes/musd-btc-lp/params.test.ts`, `web/src/lib/tx/stepper.test.ts`

**Interfaces:**
- Consumes: `BorrowAuthorisation`, `Hints` (Task 2); `StepKind` (Task 5).
- Produces: `type BorrowCall = { amount: bigint; upperHint: Address; lowerHint: Address; signature: Hex; deadline: bigint }`; `buildBorrow(auth: BorrowAuthorisation, hints: Hints): BorrowCall`; `encodeBorrowAndEnterCall(borrow: BorrowCall, params: EnterParams, permit?: ExecutorPermit): Hex`; stepper event `{ type: "signature-expired" }` replacing `"permit-expired"`.

- [ ] **Step 1: Update and add the tests first**

`params.test.ts`: add `buildBorrow, encodeBorrowAndEnterCall` to the `./params` import and:

```ts
describe("borrowAndEnter call", () => {
  it("builds the Borrow struct from the authorisation and hints, and encodes all three arguments", () => {
    const auth = { amount: MUSD_20, nonce: 2n, deadline: 99n, signature: `0x${"ab".repeat(65)}` } as const;
    const hints = { upperHint: EXECUTOR, lowerHint: ME, found: true };
    const borrow = buildBorrow(auth, hints);
    expect(borrow).toEqual({ amount: MUSD_20, upperHint: EXECUTOR, lowerHint: ME, signature: auth.signature, deadline: 99n });
    const params: EnterParams = {
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 1n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: 99n,
      recipient: ME,
    };
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeBorrowAndEnterCall(borrow, params) });
    expect(decoded.functionName).toBe("borrowAndEnter");
    expect(decoded.args).toEqual([borrow, NO_PERMIT, params]);
  });
});
```

(`EXECUTOR` and `ME` are the file's existing checksummed constants; viem decodes addresses checksummed.)

`stepper.test.ts`: replace every `{ type: "permit-expired" }` with `{ type: "signature-expired" }`, rename the two tests to "returns to the first signature when one expires, resetting the steps after it" and "ignores signature expiry without a signature step", and add:

```ts
  it("walks permit → borrow authorisation → send", () => {
    const state = run(
      createStepper(["permit", "borrow", "enter"]),
      { type: "start" },
      { type: "signed" },
      { type: "start" },
      { type: "signed" },
    );
    expect(state.active).toBe(2);
    expect(state.steps.map((step) => step.status)).toEqual(["done", "done", "idle"]);
  });

  it("resets a borrow-only plan to the borrow signature when it expires", () => {
    const state = run(createStepper(["borrow", "enter"]), { type: "start" }, { type: "signed" }, { type: "signature-expired" });
    expect(state).toEqual(createStepper(["borrow", "enter"]));
  });

  it("never takes a transaction hash for a borrow signature", () => {
    const signing = run(createStepper(["borrow", "enter"]), { type: "start" });
    expect(run(signing, { type: "submitted", hash: HASH })).toEqual(signing);
  });
```

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp/params.test.ts src/lib/tx/stepper.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

`params.ts`: add imports `import type { BorrowAuthorisation } from "@/lib/trove/borrow-signature";` and `import type { Hints } from "@/lib/trove/hints";`, then add after `buildEnterParams`:

```ts
/** The executor's Borrow struct (spec 11.2). */
export type BorrowCall = { amount: bigint; upperHint: Address; lowerHint: Address; signature: Hex; deadline: bigint };

export function buildBorrow(auth: BorrowAuthorisation, hints: Hints): BorrowCall {
  return {
    amount: auth.amount,
    upperHint: hints.upperHint,
    lowerHint: hints.lowerHint,
    signature: auth.signature,
    deadline: auth.deadline,
  };
}

export function encodeBorrowAndEnterCall(borrow: BorrowCall, params: EnterParams, permit: ExecutorPermit = NO_PERMIT): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "borrowAndEnter", args: [borrow, permit, params] });
}
```

`stepper.ts`: in `StepperEvent` replace `| { type: "permit-expired" }` with `| { type: "signature-expired" }`; add after `hasStarted`:

```ts
/** Steps the user signs without a transaction. */
function isSignature(kind: StepKind): boolean {
  return kind === "permit" || kind === "borrow";
}
```

and replace the `permit-expired`, `signed`, and `submitted` cases with:

```ts
    case "signature-expired": {
      const first = state.steps.findIndex((current) => isSignature(current.kind));
      if (first === -1) return state;
      return {
        steps: state.steps.map((current, index) => (index >= first ? { kind: current.kind, status: "idle" } : current)),
        active: first,
      };
    }
```

```ts
    case "signed":
      return step && isSignature(step.kind) && step.status === "awaiting-wallet" ? replace({ ...step, status: "done" }, true) : state;
    case "submitted":
      return step && !isSignature(step.kind) && step.status === "awaiting-wallet"
        ? replace({ ...step, status: "submitted", hash: event.hash })
        : state;
```

In `web/src/lib/routes/musd-btc-lp/useEntryFlow.ts`, replace `dispatch({ type: "permit-expired" });` with `dispatch({ type: "signature-expired" });` (Task 8 rewrites this file; this keeps it compiling now).

- [ ] **Step 3: Run the tests**

Run: `cd web && npx vitest run src/lib && npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/routes/musd-btc-lp/params.ts web/src/lib/routes/musd-btc-lp/params.test.ts web/src/lib/tx/stepper.ts web/src/lib/tx/stepper.test.ts web/src/lib/routes/musd-btc-lp/useEntryFlow.ts
git commit -m "feat(web): encode borrowAndEnter and add the borrow signature step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Route page in borrow mode and the dashboard entry point

**Files:**
- Modify: `web/src/components/lp/ModeToggle.tsx`, `AmountForm.tsx`, `RisksCard.tsx`, `EntryPreviewCard.tsx`, `LpRoutePage.tsx`; `web/src/components/dashboard/ReadinessCard.tsx`
- Create: `web/src/components/lp/TroveChangeCard.tsx`

**Interfaces:**
- Consumes: Task 5 (`EntryIntent.mode`, `EntryPreview.borrow`, `entryQuery`).
- Produces: `TroveChangeCard({ trove, effect, price, mcr })`; `ModeToggle({ walletKind, mode, onChange })`; `AmountForm({ amount, slippageBps, max, maxLabel, onChange })`; `RisksCard({ borrow })`; `EntryPreviewCard({ …, borrowFee })`.

- [ ] **Step 1: Components**

Replace `web/src/components/lp/ModeToggle.tsx`:

```tsx
import type { EntryMode } from "@/lib/routes/musd-btc-lp/intent";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

/** Deposit wallet MUSD, or Borrow & Deploy (EOAs only, FR-23). */
export function ModeToggle({
  walletKind,
  mode,
  onChange,
}: {
  walletKind: WalletKind | undefined;
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const canBorrow = walletKind !== undefined && walletCapabilities(walletKind).borrowAndDeploy;
  const option = (value: EntryMode, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={
        mode === value
          ? "rounded-full bg-white px-3 py-1.5 shadow-sm"
          : "rounded-full px-3 py-1.5 text-muted disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
  return (
    <div className="mt-4">
      <div role="radiogroup" aria-label="Funding" className="inline-flex rounded-full bg-line p-1 text-xs font-semibold">
        {option("deposit", "Deposit MUSD")}
        {option("borrow", "Borrow & Deploy", !canBorrow)}
      </div>
      {walletKind === "smart-account" && (
        <p className="mt-1 text-xs text-muted">Borrow & Deploy needs a standard wallet signature.</p>
      )}
      {mode === "borrow" && (
        <p className="mt-1 text-xs text-muted">Borrow MUSD against your Trove and deposit it in one transaction.</p>
      )}
    </div>
  );
}
```

In `AmountForm.tsx`: rename the prop `walletMusd: bigint` to `max: bigint` and add `maxLabel: string`; the Max button uses `formatUnits(max, 18)`; the hint line becomes `<p className="text-xs text-muted">{maxLabel}: {formatToken(max, 18, 2)} MUSD</p>`.

Replace `web/src/components/lp/RisksCard.tsx`:

```tsx
const RISKS = [
  "Impermanent loss: if the BTC price moves, your pool share can be worth less than holding MUSD.",
  "About half of your deposit becomes BTC. If this MUSD is borrowed against BTC, a BTC drop hits your Trove and this position at the same time.",
  "MezoRoute is unaudited software.",
];

const BORROW_RISK = "Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.";

export function RisksCard({ borrow = false }: { borrow?: boolean }) {
  const risks = borrow ? [BORROW_RISK, ...RISKS] : RISKS;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Risks</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
```

In `EntryPreviewCard.tsx`: add an optional prop `borrowFee?: bigint` (type `borrowFee?: bigint`) and, as the first `<li>` of the "What happens" list:

```tsx
        {borrowFee !== undefined && (
          <li>
            MezoRoute borrows {musd(quote.musdIn)} from your Trove; the {musd(borrowFee)} borrowing fee is added to your debt.
          </li>
        )}
```

Create `web/src/components/lp/TroveChangeCard.tsx`:

```tsx
import { StatRow } from "@/components/dashboard/StatRow";
import type { Trove } from "@/lib/dashboard/snapshot";
import { formatPercent } from "@/lib/format";
import type { BorrowEffect } from "@/lib/trove/borrow";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio } from "@/lib/trove/health";
import { musd } from "./units";

/** The Trove before → after the borrow (Flow D step 2). */
export function TroveChangeCard({ trove, effect, price, mcr }: { trove: Trove; effect: BorrowEffect; price: bigint; mcr: bigint }) {
  const cr = collateralRatio(trove, price);
  const percent = (value: bigint | null) => (value === null ? "—" : formatPercent(value, 1));
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Your Trove after this borrow</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Debt" sub={`includes the ${musd(effect.fee)} borrowing fee`}>
          {musd(trove.debt)} → {musd(effect.newDebt)}
        </StatRow>
        <StatRow label="Collateral ratio" sub={`minimum ${percent(mcr)}, MezoRoute floor ${percent(CR_SAFETY_FLOOR)}`} strong>
          {percent(cr)} → {percent(effect.newCr)}
        </StatRow>
      </dl>
    </section>
  );
}
```

In `ReadinessCard.tsx`, after the existing `readiness.state === "ready"` block, add:

```tsx
      {readiness.state === "can-borrow" && network.executor && (
        <div className="mt-4">
          <Link
            href="/route/lp/?mode=borrow"
            className="inline-block rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
          >
            Borrow & Deploy
          </Link>
        </div>
      )}
```

- [ ] **Step 2: Route page**

In `LpRoutePage.tsx` (`LpRouteForm`):
1. Add `import { TroveChangeCard } from "./TroveChangeCard";`.
2. Change `update`'s parameter type to `Pick<EntryIntent, "amount" | "slippageBps" | "mode">`.
3. Replace `<ModeToggle walletKind={walletKind} />` with `<ModeToggle walletKind={walletKind} mode={intent.mode} onChange={(mode) => update({ ...intent, mode })} />`.
4. Replace the `AmountForm` element with:

```tsx
        <AmountForm
          amount={intent.amount}
          slippageBps={intent.slippageBps}
          max={preview.borrow ? preview.borrow.limit : data.snapshot.dashboard.musd}
          maxLabel={preview.borrow ? "You can borrow" : "In your wallet"}
          onChange={(next) => update({ ...next, mode: intent.mode })}
        />
```

5. Pass `borrowFee={preview.borrow?.effect?.fee}` to `EntryPreviewCard`.
6. After `EntryPreviewCard`, add:

```tsx
      {preview.borrow?.trove && preview.borrow.effect && (
        <TroveChangeCard
          trove={preview.borrow.trove}
          effect={preview.borrow.effect}
          price={data.snapshot.dashboard.price}
          mcr={data.snapshot.dashboard.protocol.mcr}
        />
      )}
```

7. Replace `<RisksCard />` with `<RisksCard borrow={intent.mode === "borrow"} />`.

- [ ] **Step 3: Verify**

Run: `cd web && npm test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | grep -E "rror|/route|check-relayer"`
Expected: all tests pass; build lists `○ /route/lp`; `check-relayer-bundle: ok`.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/components/lp/ModeToggle.tsx web/src/components/lp/AmountForm.tsx web/src/components/lp/RisksCard.tsx web/src/components/lp/EntryPreviewCard.tsx web/src/components/lp/TroveChangeCard.tsx web/src/components/lp/LpRoutePage.tsx web/src/components/dashboard/ReadinessCard.tsx
git commit -m "feat(web): add the Borrow & Deploy mode to the LP route page and the dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Confirm page and the borrow flow

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/useEntryFlow.ts`, `web/src/components/lp/ConfirmSummary.tsx`, `web/src/components/lp/EntryStepper.tsx`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6.
- Produces: `useEntryFlow` handles `"borrow"` steps and sends `borrowAndEnter` in borrow mode.

- [ ] **Step 1: The flow hook**

In `useEntryFlow.ts`:
1. Imports: add `readContract` to the `wagmi/actions` import; add `BORROW_USED` to the outcomes import; add `import { borrowAuthorisationState, borrowTypedData, type BorrowAuthorisation } from "@/lib/trove/borrow-signature";`, `import { borrowEffect } from "@/lib/trove/borrow";`, `import { findHints, type HintRead } from "@/lib/trove/hints";`; add `buildBorrow, encodeBorrowAndEnterCall` to the `./params` import.
2. Add `const borrowAuth = useRef<BorrowAuthorisation | null>(null);` after `permit`.
3. Add after `signPermit`:

```ts
  async function signBorrow(sendPin: SendPin) {
    const fresh = await input.refresh();
    const auth = {
      amount: musdIn,
      nonce: fresh.snapshot.borrowNonce,
      deadline: fresh.snapshot.blockTimestamp + DEADLINE_SECONDS,
    };
    const typedData = borrowTypedData({ network, borrower: sendPin.account, ...auth });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    borrowAuth.current = { ...auth, signature };
    dispatch({ type: "signed" });
  }
```

4. In `enter`, right after `const fresh = await input.refresh();` and the `preview` / block checks (keep them), replace the lines from `const params = buildEnterParams(...)` through `router.push(...)` with:

```ts
    const params = buildEnterParams(preview.quote, preview.minimums, preview.deadline, sendPin.account);
    const usedPermit = hasPermitStep && signed ? signed : NO_PERMIT;
    const to = input.executor;
    let data = encodeEnterCall(params, usedPermit);
    if (input.intent.mode === "borrow") {
      const auth = borrowAuth.current;
      const state = auth ? borrowAuthorisationState(auth, nowSeconds(), fresh.snapshot.borrowNonce) : "expired";
      if (state === "used") throw new BlockedError(BORROW_USED);
      if (!auth || state === "expired") {
        borrowAuth.current = null;
        dispatch({ type: "signature-expired" });
        throw new BlockedError(PERMIT_EXPIRED);
      }
      const { trove, price, protocol } = fresh.snapshot.dashboard;
      if (!trove) throw new BlockedError(preview.block?.outcome ?? AMOUNT_TOO_SMALL);
      const read: HintRead = (call) => readContract(config, { ...call, chainId: sendPin.chainId } as never);
      const hints = await findHints(read, {
        network,
        nicr: borrowEffect(trove, price, protocol, auth.amount).newNicr,
        troveCount: fresh.snapshot.system.troveCount,
        seed: BigInt(Math.floor(Math.random() * 2 ** 32)),
      });
      const borrow = buildBorrow(auth, hints);
      await simulateContract(config, {
        address: input.executor,
        abi: mezoRouteExecutorAbi,
        functionName: "borrowAndEnter",
        args: [borrow, usedPermit, params],
        account: sendPin.account,
        chainId: sendPin.chainId,
      });
      data = encodeBorrowAndEnterCall(borrow, params, usedPermit);
    } else {
      // A simulated revert is decoded and nothing is sent.
      await simulateContract(config, {
        address: input.executor,
        abi: mezoRouteExecutorAbi,
        functionName: "enter",
        args: [params, usedPermit],
        account: sendPin.account,
        chainId: sendPin.chainId,
      });
    }
    const hash = await submitCall(config, { to, data }, sendPin);
    dispatch({ type: "submitted", hash });
    router.push(`/tx/?hash=${hash}`);
```

(Delete the old `simulateContract` + `submitCall` + `dispatch` + `router.push` lines this replaces.)

5. In `runActive`, dispatch the borrow step: replace the `if/else if/else` with:

```ts
      if (step.kind === "permit") await signPermit(sendPin);
      else if (step.kind === "borrow") await signBorrow(sendPin);
      else if (step.kind === "approve") await approve(sendPin);
      else await enter(sendPin);
```

6. Add `useDeposit: () => router.push(`/route/lp/${entryQuery({ ...input.intent, mode: "deposit" })}`),` to the `showError` handlers.

- [ ] **Step 2: Confirm page components**

In `EntryStepper.tsx`, add to `COPY`:

```ts
  borrow: {
    title: "Sign the borrow authorisation",
    detail: "Lets MezoRoute borrow exactly this amount from your Trove to your own wallet, inside the deposit transaction. Signing costs no gas.",
    action: "Sign",
  },
```

In `ConfirmSummary.tsx`: change the heading to `{preview.borrow ? "Review your borrow and deposit" : "Review your deposit"}`, change the first row's label to `{preview.borrow ? "You borrow and deposit" : "You deposit"}`, and add after the MezoRoute fee row:

```tsx
          {preview.borrow?.effect && (
            <>
              <StatRow label="Borrowing fee" sub="added to your Trove debt">
                {musd(preview.borrow.effect.fee)}
              </StatRow>
              <StatRow label="Trove debt after">{musd(preview.borrow.effect.newDebt)}</StatRow>
              <StatRow label="Collateral ratio after" strong>
                {preview.borrow.effect.newCr === null ? "—" : formatPercent(preview.borrow.effect.newCr, 1)}
              </StatRow>
            </>
          )}
```

(add `formatPercent` to the `@/lib/format` import).

- [ ] **Step 3: Verify**

Run: `cd web && npm test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | grep -E "rror|/route|check-relayer"`
Expected: all pass; `○ /route/lp/confirm`; `check-relayer-bundle: ok`.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/routes/musd-btc-lp/useEntryFlow.ts web/src/components/lp/ConfirmSummary.tsx web/src/components/lp/EntryStepper.tsx
git commit -m "feat(web): sign the borrow authorisation and send borrowAndEnter from the confirm page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Receipt shows the borrow and the Trove after it

**Files:**
- Modify: `web/src/lib/routes/musd-btc-lp/receipt.ts`, `web/src/components/receipt/ReceiptPage.tsx`
- Test: `web/src/lib/routes/musd-btc-lp/receipt.test.ts`

**Interfaces:**
- Produces: `enteredRows` lists "MUSD borrowed" first when `musdBorrowed > 0`.

- [ ] **Step 1: Failing test**

Append to `receipt.test.ts`:

```ts
describe("enteredRows for Borrow & Deploy", () => {
  it("lists the borrowed MUSD first", () => {
    const event = findEnteredEvent([enteredLog], EXECUTOR)!;
    const rows = enteredRows({ ...event, musdBorrowed: 20_000_000_000_000_000_000n });
    expect(rows[0]).toEqual({ label: "MUSD borrowed", value: "20 MUSD" });
    expect(rows).toHaveLength(10);
  });
});
```

Run: `cd web && npx vitest run src/lib/routes/musd-btc-lp/receipt.test.ts`
Expected: FAIL (`MUSD in` is first).

- [ ] **Step 2: Implement**

In `enteredRows`, return `[...(event.musdBorrowed > 0n ? [{ label: "MUSD borrowed", value: musd(event.musdBorrowed) }] : []), …existing rows]`.

In `ReceiptPage.tsx`:
1. Imports: `import { useAccount } from "wagmi";` (merge with `useConfig`), `import type { Address } from "viem";` (merge), `import { useDashboardSnapshot } from "@/lib/dashboard/useDashboardSnapshot";`, `import { collateralRatio } from "@/lib/trove/health";`, `import { formatPercent } from "@/lib/format";` (merge).
2. In `Confirmed`, after the `</dl>` of the event rows (inside the `event ?` branch), render `{event.musdBorrowed > 0n && <TroveNow />}`.
3. Add:

```tsx
function TroveNow() {
  const { address } = useAccount();
  return address ? <TroveNowFor account={address} /> : null;
}

/** The Trove read after confirmation (Flow D step 7). */
function TroveNowFor({ account }: { account: Address }) {
  const { data } = useDashboardSnapshot(account);
  const trove = data?.snapshot.trove;
  if (!data || !trove) return null;
  const cr = collateralRatio(trove, data.snapshot.price);
  return (
    <>
      <h2 className="mt-4 text-sm font-semibold">Your Trove now</h2>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Debt">{`${formatToken(trove.debt, 18, 2)} MUSD`}</StatRow>
        <StatRow label="Collateral ratio">{cr === null ? "—" : formatPercent(cr, 1)}</StatRow>
      </dl>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd web && npm test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | grep -E "rror|/tx|check-relayer"`
Expected: all pass; `○ /tx`; `check-relayer-bundle: ok`.

- [ ] **Step 4: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute && git branch --show-current && git status --short
git add web/src/lib/routes/musd-btc-lp/receipt.ts web/src/lib/routes/musd-btc-lp/receipt.test.ts web/src/components/receipt/ReceiptPage.tsx
git commit -m "feat(web): show the borrowed MUSD and the Trove after Borrow & Deploy on the receipt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Live QA on testnet (agent) and the measured gas

**Files:** `web/src/lib/quote/gas.ts` (measured `BORROW_ENTER_GAS`) and its preview test expectation; anything else only as a `fix(web):` with a failing test first.

- [ ] **Step 1:** `cd web && npm run build`, serve `web/out` on 4173 (`python3 -m http.server`), start the local QA signer from F3 (scratchpad `qa-signer.mjs`, allowing `WithdrawMUSD` typed data from BOS with borrower = recipient = the deployer, and sends to the executor and MUSD only), load its init script with `page.context().addInitScript({ path })`.
- [ ] **Step 2:** Dashboard (deployer has no wallet-MUSD shortage, so open `/route/lp/?mode=borrow` directly): amount 5 → the Trove card shows debt → debt + 5.005, CR before → after; Review → steps Sign permit, Sign the borrow authorisation, Send → receipt with "MUSD borrowed 5 MUSD" and "Your Trove now".
- [ ] **Step 3:** With `cast`: allowance deployer → executor = 0; executor MUSD/BTC/LP balances 0; Trove debt grew by 5.005 MUSD (plus accrued interest); the `Entered` event's `musdBorrowed` = 5e18; `quoteEntry` on the pool at the previous block matches the event (temporary test, deleted after).
- [ ] **Step 4:** Record `gasUsed` with hints; set `BORROW_ENTER_GAS` to that value rounded up to the next 50,000 plus 10%, update the preview test's `2_200_000n`, commit `fix(web): set the Borrow & Deploy gas estimate from the measured transaction`.
- [ ] **Step 5:** Read-only checks with a keyless mock: smart-account (Unisat mock) sees the disabled toggle and the message; amount above the limit → "Amount exceeds what your Trove can safely borrow."; 360 px layout of route and confirm in borrow mode. Stop the signer and the server; delete the signer's files.

---

### Task 11: Docs, preview, user QA, merge

**Files:** `PRODUCT_SPEC.md` (Flow D step 3 → "below the 160% safety floor (`CR_SAFETY_FLOOR`)"; §11.4 gas note → measured gas with hints vs 2.18M without; §16 "F4 done <date>: …"), `CLAUDE.md` (Borrow & Deploy notes: mode in the URL, hints with zero fallback, borrow nonce check, the chain-replayed signature fixture), F4 design doc (QA result).

- [ ] **Step 1:** Docs edits above (except §16 and the QA result), `npm test && npm run build`, `forge test`, commit `docs: record the F4 Borrow & Deploy notes`.
- [ ] **Step 2:** `vercel deploy` preview; give the user the URL and checklist: MetaMask (EOA with a Trove): `/route/lp/?mode=borrow`, amount 1 → Review → Sign permit → Sign borrow → Send → receipt with "MUSD borrowed" and "Your Trove now"; Unisat: Borrow & Deploy disabled with the message.
- [ ] **Step 3:** After the user's pass: record the QA result and §16, commit `docs: record that F4 QA passed`, merge `--no-ff` into `main`, `npm test && npm run build` and `forge test` on `main`, push `main`, delete the branch.
