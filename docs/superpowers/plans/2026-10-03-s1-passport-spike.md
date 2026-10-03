# S1 — Mezo Passport + Static Export Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove, on a static Next.js 14 export deployed to Vercel, that both an EVM wallet and a Bitcoin wallet (through Mezo Passport) can connect to Mezo testnet, approve MUSD, and call `enter` on the deployed `MezoRouteExecutor` — and record what F1 must build on.

**Architecture:** A new `web/` app at the repository root, following the spec §10 module layout (`src/lib/config`, `src/lib/wallet`, `src/lib/routes/musd-btc-lp`, `src/lib/tx`, `src/lib/quote`). The wallet tree (wagmi + RainbowKit + Passport) is rendered client-only, so the static export ships a plain shell. Every pure function (config, capability detection, amount parsing, entry params, receipt decoding, error classification) is unit-tested with Vitest; wallet flows are verified by hand on live testnet, locally and on a Vercel preview.

**Tech Stack:** Next.js 14.2.35 (App Router, `output: "export"`), React 18.3.1, TypeScript 5, `@mezo-org/passport` 0.17.2, `@rainbow-me/rainbowkit` 2.0.2, wagmi 2.19.5, viem 2.57.2, TanStack Query 5.104.1, Tailwind CSS 3.4.19, Vitest 5.0.3, Vercel CLI 54.

**Spec:** `PRODUCT_SPEC.md` v2.3 — §4 (Passport row), §7 Flow A and Flow C, §9, §10, §11.1–11.3, §11.6, §12, §13, §16 (task S1), §18 (Passport risk row).

## Findings made while writing this plan (3 Oct 2026)

These come from reading the published packages and probing the endpoints. The plan is built around them.

1. **The testnet relayer hardcoded in Passport is dead.** `@mezo-org/orangekit-smart-account` 1.0.0-beta.24 (pulled in by Passport 0.17.2) sends Bitcoin-wallet transactions to `https://test.mezo.org/api/v2/relay/transactions` and deploys Safes through `https://test.mezo.org/api/v2/relay/deploy-safe`. `test.mezo.org` answers every request with Cloudflare 403 "DNS points to prohibited IP". `https://testnet.mezo.org/api/v2/relay/{transactions,deploy-safe}` is live and allows CORS from any origin (checked from `http://localhost:3000` and `https://x.vercel.app`). Task 2 rewrites the URL after every install. Whether that relayer accepts the hardcoded testnet refund receiver (`0x6e80164ea60673D64d5d6228beb684a1274Bb017`) can only be found out in Task 6.
2. **The Passport README is out of date.** In 0.17.2, `getConfig({ appName, walletConnectProjectId, mezoNetwork, wallets })` builds a config for **one** network. `walletConnectProjectId` is required.
3. **A Bitcoin wallet's smart account is a Safe that is deployed on its first transaction.** Until then `getCode` is empty, so the spec's `getCode` check (Flow A) would call it an EOA. Wallet kind must come from the connector (`type === "orangekit"`) first.
4. **Smart accounts cannot sign typed data.** The OrangeKit client throws `Unsupported method` from `signTypedData`. This confirms the spec: smart accounts use approvals and get no permits and no Borrow & Deploy.
5. **The Safe pays for its own gas, so it must hold BTC.** OrangeKit estimates gas from the Safe address and throws `Not enough native token balance to cover transaction gas…` when the Safe is short. The relayer is refunded from the Safe.
6. **A relayed transaction can succeed even though our call inside it reverted.** OrangeKit sets a non-zero `safeTxGas`/`gasPrice`, so Safe emits `ExecutionFailure(bytes32,uint256)` instead of reverting the outer transaction. "Receipt status success" is therefore not proof that `enter` ran.
7. **The relayer reports failure as the hash `"0x"`.** `MezoTransactionSender` returns `{ hash: transactionHash ?? "0x" }` and does not throw.
8. **wagmi 3.x is now `latest` on npm.** Passport's peer range is `wagmi ^2.5.12`, so wagmi has to be pinned to 2.19.5. Passport also pins `@rainbow-me/rainbowkit` to exactly 2.0.2; using any other version would install two RainbowKit copies.
9. **Static export cannot prerender `/tx/[hash]`** (spec §9) without a list of hashes. F1 needs `/tx/?hash=0x…` instead. This plan only records the decision (Task 6).

## Prerequisites (the user provides these)

- A free WalletConnect (Reown) project ID from `https://cloud.reown.com` → `web/.env.local` as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<id>` (Task 3).
- MetaMask (or any EVM browser wallet) in the browser used for testing (Task 5).
- One Bitcoin wallet extension — Unisat, OKX, or Xverse — with a native SegWit address (Task 6). Mezo testnet accepts both mainnet and testnet Bitcoin addresses; no BTC on Bitcoin is spent, the wallet only signs messages.
- Vercel CLI logged in (already true: `vercel whoami` → `hms1499`).
- Test funds come from the deployer key in `contracts/.env`: on 3 Oct it held 0.055 BTC and 1,850 MUSD on testnet. The testnet gas price is 146 wei, so 0.0001 BTC covers many transactions.

## Global Constraints

- All frontend code lives in `web/`; modules follow spec §10 (`web/src/lib/config/`, `web/src/lib/wallet/`, `web/src/lib/routes/musd-btc-lp/`, `web/src/lib/tx/`, `web/src/lib/quote/`, `web/src/app/`).
- Exact versions (`--save-exact`): `next@14.2.35`, `react@18.3.1`, `react-dom@18.3.1`, `@mezo-org/passport@0.17.2`, `@rainbow-me/rainbowkit@2.0.2`, `wagmi@2.19.5`, `viem@2.57.2`, `@tanstack/react-query@5.104.1`. There must be one copy of RainbowKit, wagmi, and viem (`npm ls` shows `deduped`).
- Testnet only: chain ID `31611`, RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org` (spec §20).
- Addresses (spec §11.1): MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, BTC `0x7b7C000000000000000000000000000000000000`, Router `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`, PoolFactory `0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A`, Pool `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9`, MezoRouteExecutor `0xB36B2E012003840951CFf00fA6b1E3237A110920` with pinned fee **10 bps**.
- All token maths in `bigint`; never JS `number` (spec §12).
- Transaction deadline = now + 600 s; default slippage 1% (spec §12).
- No backend; static files only (spec §10).
- Approvals for the exact transaction amount only (spec FR-06); `enter` is called with a zero-value permit (`value = 0` → use the existing allowance, spec §11.2).
- Receipts show only `Entered` event values (spec FR-11). Pre-transaction values are "estimated" (spec §9 copy rules). User-facing error text uses spec §13 wording where a row matches.
- Code, comments, commits, and docs are in English. Commit prefixes: `feat(web):`, `chore(web):`, `test(web):`, `docs:`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The repo sits in an iCloud-synced Desktop. `web/node_modules` is a symlink to `web/node_modules.nosync` so that iCloud skips it. Before every commit, run `git branch --show-current` (must print `feat/s1-passport-spike`) and look for `* 2.*` / `* 2` duplicates in `git status --short`; delete a duplicate only after confirming it is identical to the original.
- Never print `PRIVATE_KEY`. Load it with `set -a && source .env && set +a` inside `contracts/`.

## Review Focus

Five conditions the spec implies, ranked by how likely they are to hurt a real user. No end-to-end test covers them, so each one is pinned by a unit test in the task that owns the code:

1. **The Bitcoin-wallet transaction confirms, but the `enter` inside the Safe reverted** (Finding 6). Expected: the UI reports a failure, not a receipt. Pinned in Task 4 by `hasSafeExecutionFailure` tests; `sendCall` throws `SmartAccountCallFailedError`.
2. **The relayer rejects the transaction and the wallet returns hash `"0x"`** (Finding 7). Expected: an immediate relay error, not an endless "confirming" state. Pinned in Task 4 by `assertTxHash` tests.
3. **A Bitcoin wallet connects for the first time and its Safe is not deployed yet** (Finding 3). Expected: it is a smart account (no permit, no Borrow & Deploy). Pinned in Task 3 by the `walletKind` test "orangekit connector without code".
4. **The Safe holds no BTC for gas** (Finding 5). Expected: "You need test BTC to submit transactions." (spec §13), both before sending (blocker) and when OrangeKit throws. Pinned in Task 4 by the `enterBlocker` needs-gas test and the `classifySendError` needs-gas test.
5. **Odd amount input**: empty, `0`, `.5`, `1.`, 19 decimals, `1e3`, `-1`, `1,5`, and amounts exactly equal to the balance or the cap. Expected: invalid input is rejected without throwing; amounts equal to the balance or the cap are allowed (the contract reverts only on `musdIn > maxMusdIn`). Pinned in Task 4 by the `parseMusdAmount` and `enterBlocker` boundary tests.

---

### Task 1: Scaffold `web/` with the pinned stack, testnet config, and static export

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.mjs`, `web/postcss.config.mjs`, `web/tailwind.config.ts`, `web/.eslintrc.json`, `web/.gitignore`, `web/.vercelignore`, `web/vitest.config.ts`
- Create: `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/src/app/page.tsx`
- Create: `web/src/lib/config/testnet.ts`
- Test: `web/src/lib/config/testnet.test.ts`

**Interfaces:**
- Produces: `testnet` (const object: `chainId: 31611`, `rpcUrl`, `explorerUrl`, `faucetUrl`, `executorFeeBps: 10n`, `addresses: { musd, btc, router, poolFactory, pool, executor }` typed `Address`), `explorerTxUrl(hash: string): string`. npm scripts `dev`, `build`, `lint`, `test`.

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git switch main && git pull --ff-only
git switch -c feat/s1-passport-spike
```

- [ ] **Step 2: Write the scaffold files**

`web/package.json`:

```json
{
  "name": "mezoroute-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run"
  }
}
```

`web/tsconfig.json` (`target: ES2020` is required for bigint literals such as `10n`):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "node_modules.nosync"]
}
```

`web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Passport and OrangeKit ship ES modules without "type": "module"; let Next transpile them.
  transpilePackages: [
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-smart-account",
  ],
  webpack: (config) => {
    // Optional server-side dependencies of WalletConnect's logger; never used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
```

`web/postcss.config.mjs`:

```js
const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };

export default config;
```

`web/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

`web/.eslintrc.json`:

```json
{ "extends": "next/core-web-vitals" }
```

`web/.gitignore`:

```
/node_modules
/node_modules.nosync
/.next/
/out/
/.vercel
.env*.local
*.tsbuildinfo
```

`web/.vercelignore`:

```
node_modules
node_modules.nosync
.next
out
.env.local
```

`web/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
```

`web/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MezoRoute · S1 spike",
  description: "Mezo Passport and static-export spike on Mezo testnet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
```

`web/src/app/page.tsx`:

```tsx
export default function Home() {
  return <main className="p-6">MezoRoute · S1 spike</main>;
}
```

- [ ] **Step 3: Keep `node_modules` out of iCloud, then install the pinned dependencies**

```bash
cd /Users/vanhuy/Desktop/mezoroute/web
mkdir node_modules.nosync && ln -s node_modules.nosync node_modules
npm install --save-exact next@14.2.35 react@18.3.1 react-dom@18.3.1 \
  @mezo-org/passport@0.17.2 @rainbow-me/rainbowkit@2.0.2 wagmi@2.19.5 viem@2.57.2 \
  @tanstack/react-query@5.104.1
npm install --save-exact -D typescript@5 @types/react@18 @types/react-dom@18 @types/node@22 \
  tailwindcss@3.4.19 postcss autoprefixer eslint@8 eslint-config-next@14.2.35 vitest@5.0.3
test -L node_modules && echo "node_modules is still a symlink"
```

Expected: both installs succeed and the last line prints. If npm stops with `ERESOLVE`, create `web/.npmrc` containing `legacy-peer-deps=true`, re-run the two installs, and record the conflicting package in the spike findings (Task 6). If `test -L` fails, npm replaced the symlink: `rm -rf node_modules node_modules.nosync`, recreate the symlink, and run `npm install` again (once `package.json` lists the dependencies, the install goes through the symlink).

- [ ] **Step 4: Check that shared libraries are installed once**

```bash
cd /Users/vanhuy/Desktop/mezoroute/web
npm ls @rainbow-me/rainbowkit wagmi viem @mezo-org/orangekit-smart-account
```

Expected: one `@rainbow-me/rainbowkit@2.0.2`, one `wagmi@2.19.5`, one `viem@2.57.2`, one `@mezo-org/orangekit-smart-account@1.0.0-beta.24`; every other occurrence is marked `deduped`. A second copy is a finding: record it in Task 6 and align the top-level version with the one Passport requires.

- [ ] **Step 5: Write the failing config test**

`web/src/lib/config/testnet.test.ts`:

```ts
import { getAddress, isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { explorerTxUrl, testnet } from "./testnet";

describe("testnet config", () => {
  it("pins Mezo testnet chain id 31611", () => {
    expect(testnet.chainId).toBe(31611);
  });

  it.each(Object.entries(testnet.addresses))("%s is a checksummed address", (_name, address) => {
    expect(isAddress(address, { strict: true })).toBe(true);
    expect(getAddress(address)).toBe(address);
  });

  it("pins the deployed executor and its 10 bps fee (spec 11.1)", () => {
    expect(testnet.addresses.executor).toBe("0xB36B2E012003840951CFf00fA6b1E3237A110920");
    expect(testnet.executorFeeBps).toBe(10n);
  });

  it("builds explorer transaction links", () => {
    expect(explorerTxUrl("0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/config/testnet.test.ts`
Expected: FAIL — `Failed to resolve import "./testnet"`.

- [ ] **Step 7: Implement the config**

`web/src/lib/config/testnet.ts`:

```ts
import type { Address } from "viem";

/** Mezo testnet deployment (PRODUCT_SPEC.md §11.1, §20). Every address the app calls is pinned here. */
export const testnet = {
  chainId: 31611,
  rpcUrl: "https://rpc.test.mezo.org",
  explorerUrl: "https://explorer.test.mezo.org",
  faucetUrl: "https://faucet.test.mezo.org",
  /** Fee the executor was deployed with; the app refuses to enter if the chain disagrees. */
  executorFeeBps: 10n,
  addresses: {
    musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
    btc: "0x7b7C000000000000000000000000000000000000",
    router: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
    poolFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
    pool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
    executor: "0xB36B2E012003840951CFf00fA6b1E3237A110920",
  },
} as const satisfies {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  executorFeeBps: bigint;
  addresses: Record<string, Address>;
};

export function explorerTxUrl(hash: string): string {
  return `${testnet.explorerUrl}/tx/${hash}`;
}
```

- [ ] **Step 8: Run the test to make sure it passes**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/config/testnet.test.ts`
Expected: PASS (9 tests: 6 addresses + 3).

- [ ] **Step 9: Build the static export**

```bash
cd /Users/vanhuy/Desktop/mezoroute/web
npm run build && test -f out/index.html && echo "static export OK"
```

Expected: `next build` prints `○ /` as static, lint and type check pass, and `static export OK` prints. `next-env.d.ts` is generated; it is committed.

- [ ] **Step 10: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # must print feat/s1-passport-spike
git status --short           # no "* 2.*" duplicates; node_modules.nosync and out/ must not appear
git add web
git commit -m "chore(web): scaffold Next.js 14 static export with pinned Passport stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Point OrangeKit at the live testnet relayer

**Files:**
- Create: `web/scripts/patch-relayer.mjs`
- Modify: `web/package.json` (scripts `postinstall`, `prebuild`)
- Test: `web/scripts/patch-relayer.test.ts`, `web/scripts/relayer-installed.test.ts`

**Interfaces:**
- Produces: `DEAD_RELAYER`, `LIVE_RELAYER`, `RELAYER_FILES` (string constants), `patchRelayerSource(source: string): { status: "patched" | "already-patched" | "not-found"; source: string }`. After every `npm install` and before every build, the installed `@mezo-org/orangekit-smart-account` relays through `https://testnet.mezo.org`.

- [ ] **Step 1: Write the failing unit test**

`web/scripts/patch-relayer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run scripts/patch-relayer.test.ts`
Expected: FAIL — `Failed to resolve import "./patch-relayer.mjs"`.

- [ ] **Step 3: Implement the patch script**

`web/scripts/patch-relayer.mjs`:

```js
// Mezo Passport 0.17.2 pulls in @mezo-org/orangekit-smart-account 1.0.0-beta.24, which relays
// Bitcoin-wallet transactions through https://test.mezo.org. That host answers with Cloudflare
// 403 "DNS points to prohibited IP" (checked 3 Oct 2026); the live relayer is
// https://testnet.mezo.org. This script rewrites the URL in the installed package. It runs on
// postinstall and prebuild and fails loudly if the package no longer contains either URL.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEAD_RELAYER = "https://test.mezo.org/api/v2/relay/";
export const LIVE_RELAYER = "https://testnet.mezo.org/api/v2/relay/";
export const RELAYER_FILES = [
  "dist/src/lib/utils/MezoTransactionSender.js",
  "dist/src/lib/index.js",
];

export function patchRelayerSource(source) {
  if (source.includes(DEAD_RELAYER)) {
    return { status: "patched", source: source.replaceAll(DEAD_RELAYER, LIVE_RELAYER) };
  }
  if (source.includes(LIVE_RELAYER)) return { status: "already-patched", source };
  return { status: "not-found", source };
}

// The package may be hoisted to node_modules/@mezo-org or nested under another @mezo-org package.
function findPackageDirs(root, depth = 0, found = []) {
  const dir = join(root, "node_modules", "@mezo-org", "orangekit-smart-account");
  if (existsSync(join(dir, "package.json"))) found.push(dir);
  const scope = join(root, "node_modules", "@mezo-org");
  if (depth < 3 && existsSync(scope)) {
    for (const entry of readdirSync(scope)) findPackageDirs(join(scope, entry), depth + 1, found);
  }
  return found;
}

function main() {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dirs = findPackageDirs(webRoot);
  if (dirs.length === 0) throw new Error("patch-relayer: @mezo-org/orangekit-smart-account is not installed");
  for (const dir of dirs) {
    for (const file of RELAYER_FILES) {
      const path = join(dir, file);
      const { status, source } = patchRelayerSource(readFileSync(path, "utf8"));
      if (status === "not-found") {
        throw new Error(`patch-relayer: no relayer URL in ${path}; the package changed, re-check the endpoint`);
      }
      if (status === "patched") writeFileSync(path, source);
      console.log(`patch-relayer: ${status} ${path}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the unit test to make sure it passes**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run scripts/patch-relayer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing installed-package test**

`web/scripts/relayer-installed.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEAD_RELAYER, LIVE_RELAYER, RELAYER_FILES } from "./patch-relayer.mjs";

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("@mezo-org/orangekit-smart-account/package.json"));

describe("installed OrangeKit smart-account package", () => {
  it.each(RELAYER_FILES)("%s relays through testnet.mezo.org", (file) => {
    const source = readFileSync(join(packageDir, file), "utf8");
    expect(source).toContain(LIVE_RELAYER);
    expect(source).not.toContain(DEAD_RELAYER);
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run scripts/relayer-installed.test.ts`
Expected: FAIL — the installed files still contain `https://test.mezo.org/api/v2/relay/`.

- [ ] **Step 7: Wire the script into install and build**

In `web/package.json`, add two entries to `"scripts"`:

```json
    "postinstall": "node scripts/patch-relayer.mjs",
    "prebuild": "node scripts/patch-relayer.mjs",
```

Then run it through npm:

```bash
cd /Users/vanhuy/Desktop/mezoroute/web
npm install
```

Expected output includes `patch-relayer: patched …/MezoTransactionSender.js` and `patch-relayer: patched …/dist/src/lib/index.js`. A second `npm install` prints `already-patched` for both.

- [ ] **Step 8: Run all tests and the build**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npm test && npm run build`
Expected: all tests PASS (config 9, patch 3, installed 2); `prebuild` prints `already-patched` twice; the build succeeds.

- [ ] **Step 9: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # feat/s1-passport-spike
git status --short           # no duplicates
git add web/scripts web/package.json web/package-lock.json
git commit -m "fix(web): relay Bitcoin-wallet transactions through the live testnet relayer

Passport 0.17.2 hardcodes https://test.mezo.org, which Cloudflare rejects;
testnet.mezo.org serves the same relay API.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Passport wallet layer, capability detection, and connect screen

**Files:**
- Create: `web/src/lib/wallet/capabilities.ts`, `web/src/lib/wallet/passport.ts`
- Create: `web/src/app/providers.tsx`, `web/src/app/client-providers.tsx`
- Create: `web/src/app/_spike/Spike.tsx`, `web/src/app/_spike/WalletInfo.tsx`, `web/src/app/_spike/useWalletKind.ts`
- Create: `web/.env.example`
- Modify: `web/src/app/layout.tsx`, `web/src/app/page.tsx`
- Test: `web/src/lib/wallet/capabilities.test.ts`

**Interfaces:**
- Consumes: `testnet` from Task 1.
- Produces: `type WalletKind = "eoa" | "smart-account"`; `walletKind(input: { connectorType: string; connectorId: string; hasCode: boolean }): WalletKind`; `walletCapabilities(kind: WalletKind): { permit: boolean; borrowAndDeploy: boolean }`; `createWagmiConfig(walletConnectProjectId: string): Config`; `walletConnectProjectId(): string`; React hook `useWalletKind(): WalletKind | undefined`; default export `Spike` (client component, rendered client-only). `_spike/` is private to the App Router, and F1 deletes it.

- [ ] **Step 1: Write the failing capability tests**

`web/src/lib/wallet/capabilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { walletCapabilities, walletKind } from "./capabilities";

describe("walletKind", () => {
  it("treats an OrangeKit connector as a smart account before its Safe is deployed", () => {
    expect(walletKind({ connectorType: "orangekit", connectorId: "orangekit-unisat", hasCode: false })).toBe(
      "smart-account",
    );
  });

  it("treats an OrangeKit connector as a smart account after deployment", () => {
    expect(walletKind({ connectorType: "orangekit", connectorId: "orangekit-xverse", hasCode: true })).toBe(
      "smart-account",
    );
  });

  it("treats an injected wallet without code as an EOA", () => {
    expect(walletKind({ connectorType: "injected", connectorId: "io.metamask", hasCode: false })).toBe("eoa");
  });

  it("treats any other connector with deployed code as a smart account", () => {
    expect(walletKind({ connectorType: "walletConnect", connectorId: "walletConnect", hasCode: true })).toBe(
      "smart-account",
    );
  });
});

describe("walletCapabilities (spec FR-23)", () => {
  it("gives EOAs permits and Borrow & Deploy", () => {
    expect(walletCapabilities("eoa")).toEqual({ permit: true, borrowAndDeploy: true });
  });

  it("gives smart accounts neither", () => {
    expect(walletCapabilities("smart-account")).toEqual({ permit: false, borrowAndDeploy: false });
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/wallet/capabilities.test.ts`
Expected: FAIL — `Failed to resolve import "./capabilities"`.

- [ ] **Step 3: Implement capability detection**

`web/src/lib/wallet/capabilities.ts`:

```ts
export type WalletKind = "eoa" | "smart-account";

export type WalletCapabilities = { permit: boolean; borrowAndDeploy: boolean };

/**
 * Bitcoin wallets connect through OrangeKit and act through a Safe that is deployed lazily on the
 * first transaction, so `getCode` alone misses them until then. The connector decides first;
 * deployed code catches other contract wallets (for example a Safe connected via WalletConnect).
 */
export function walletKind(input: { connectorType: string; connectorId: string; hasCode: boolean }): WalletKind {
  if (input.connectorType === "orangekit" || input.connectorId.startsWith("orangekit-")) return "smart-account";
  return input.hasCode ? "smart-account" : "eoa";
}

/** Smart accounts cannot produce ecrecover signatures: no permits and no Borrow & Deploy (spec FR-23). */
export function walletCapabilities(kind: WalletKind): WalletCapabilities {
  return kind === "eoa" ? { permit: true, borrowAndDeploy: true } : { permit: false, borrowAndDeploy: false };
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/wallet/capabilities.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the Passport config and the client-only provider tree**

`web/.env.example`:

```
# Free project ID from https://cloud.reown.com (WalletConnect). Copy to .env.local.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

Ask the user for their Reown project ID and write it to `web/.env.local` (git-ignored) as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<id>`.

`web/src/lib/wallet/passport.ts`:

```ts
import {
  getConfig,
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";

/** wagmi config for Mezo testnet through Mezo Passport: Bitcoin wallets (OrangeKit) and EVM wallets. */
export function createWagmiConfig(walletConnectProjectId: string) {
  return getConfig({
    appName: "MezoRoute",
    mezoNetwork: "testnet",
    walletConnectProjectId,
    wallets: [
      { groupName: "Bitcoin", wallets: [unisatWalletMezoTestnet, okxWalletMezoTestnet, xverseWalletMezoTestnet] },
      { groupName: "Ethereum", wallets: [metaMaskWallet, walletConnectWallet, injectedWallet] },
    ],
  });
}

export function walletConnectProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!id) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set (see web/.env.example)");
  return id;
}
```

`web/src/app/providers.tsx`:

```tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { createWagmiConfig, walletConnectProjectId } from "@/lib/wallet/passport";

export default function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(() => createWagmiConfig(walletConnectProjectId()));
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

`web/src/app/client-providers.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

// Passport and OrangeKit use browser-only APIs, so the wallet tree renders only on the client;
// the static export ships this loading shell.
const ClientProviders = dynamic(() => import("./providers"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-500">Loading wallet…</p>,
});

export default ClientProviders;
```

Replace `web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import ClientProviders from "./client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MezoRoute · S1 spike",
  description: "Mezo Passport and static-export spike on Mezo testnet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Add the connect screen**

`web/src/app/_spike/useWalletKind.ts`:

```ts
"use client";

import { useAccount, useBytecode } from "wagmi";
import { walletKind, type WalletKind } from "@/lib/wallet/capabilities";

export function useWalletKind(): WalletKind | undefined {
  const { address, connector } = useAccount();
  const { data: bytecode, isPending } = useBytecode({ address, query: { enabled: Boolean(address) } });
  if (!address || !connector || isPending) return undefined;
  return walletKind({
    connectorType: connector.type,
    connectorId: connector.id,
    hasCode: Boolean(bytecode && bytecode !== "0x"),
  });
}
```

`web/src/app/_spike/WalletInfo.tsx`:

```tsx
"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { testnet } from "@/lib/config/testnet";
import { walletCapabilities } from "@/lib/wallet/capabilities";
import { useWalletKind } from "./useWalletKind";

export function WalletInfo() {
  const { address, chainId, connector, status } = useAccount();
  const kind = useWalletKind();
  const { btcAddress } = useBitcoinAccount();
  const { data: gas } = useBalance({ address, query: { enabled: Boolean(address) } });

  if (status !== "connected" || !address) {
    return <p className="text-sm text-slate-600">Connect an EVM or Bitcoin wallet.</p>;
  }
  const caps = kind ? walletCapabilities(kind) : undefined;
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <dt>Connector</dt>
      <dd>
        {connector?.name} ({connector?.type}, {connector?.id})
      </dd>
      <dt>Mezo account</dt>
      <dd className="break-all font-mono">{address}</dd>
      <dt>Bitcoin address</dt>
      <dd className="break-all font-mono">{btcAddress ?? "—"}</dd>
      <dt>Chain</dt>
      <dd>
        {chainId}
        {chainId === testnet.chainId ? "" : " (wrong network)"}
      </dd>
      <dt>Wallet kind</dt>
      <dd>{kind ?? "detecting…"}</dd>
      <dt>Capabilities</dt>
      <dd>
        {caps
          ? `permit ${caps.permit ? "yes" : "no"}, Borrow & Deploy ${caps.borrowAndDeploy ? "yes" : "no"}`
          : "—"}
      </dd>
      <dt>BTC for gas</dt>
      <dd>{gas ? formatUnits(gas.value, gas.decimals) : "—"}</dd>
    </dl>
  );
}
```

`web/src/app/_spike/Spike.tsx`:

```tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletInfo } from "./WalletInfo";

export default function Spike() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">MezoRoute · S1 spike</h1>
        <ConnectButton />
      </header>
      <WalletInfo />
    </main>
  );
}
```

Replace `web/src/app/page.tsx` (the dynamic import keeps Passport out of the prerendered page module):

```tsx
"use client";

import dynamic from "next/dynamic";

const Spike = dynamic(() => import("./_spike/Spike"), { ssr: false });

export default function Home() {
  return <Spike />;
}
```

- [ ] **Step 7: Build, lint, and test**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npm test && npm run build && test -f out/index.html && echo OK`
Expected: all tests PASS and the build prints `OK`. Note the `First Load JS` for `/` in the build output; it goes in the findings. If the build fails:
- `Module not found: Can't resolve '<pkg>'` for a package only WalletConnect or Passport mentions → add it to `config.externals` in `next.config.mjs`.
- `window is not defined` / `indexedDB is not defined` during prerender → a file reachable from `layout.tsx` or `page.tsx` imports Passport, RainbowKit components, or wagmi hooks directly. Only `providers.tsx` (through `client-providers.tsx`) and `_spike/*` (through `page.tsx`'s `dynamic`) may do so.
- `SyntaxError: Cannot use import statement outside a module` naming another `@mezo-org/*` package → add it to `transpilePackages`.

- [ ] **Step 8: Check the connect modal in a browser**

Start `npm run dev` in `web/` (background), open `http://localhost:3000` with the Playwright MCP browser, click **Connect Wallet**, and take a snapshot. Expected: a "Bitcoin" group (Unisat, OKX, Xverse) and an "Ethereum" group (MetaMask, WalletConnect, and an injected/browser wallet entry). No console errors except wallets that are not installed.

Then ask the user to open `http://localhost:3000` in their own browser, connect MetaMask, then disconnect and connect their Bitcoin wallet, and report the `WalletInfo` panel for each. Expected: MetaMask → kind `eoa`, permit yes. Bitcoin wallet → kind `smart-account`, permit no, a Bitcoin address, and a Mezo account address (the predicted Safe). Write down the Bitcoin wallet, its address type, and the Safe address for Task 6. A connection failure is a spike result, not a reason to stop: copy the console error into the findings and continue with Tasks 4–5 on the EVM path.

- [ ] **Step 9: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # feat/s1-passport-spike
git status --short           # no duplicates; .env.local must not appear
git add web/src web/.env.example
git commit -m "feat(web): connect EVM and Bitcoin wallets through Mezo Passport

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Entry logic — ABI, amount parsing, params, receipts, errors

**Files:**
- Create: `web/scripts/sync-abi.mjs`, `web/src/lib/abi/mezoRouteExecutor.ts` (generated), `web/src/lib/abi/router.ts`
- Create: `web/src/lib/quote/amount.ts`, `web/src/lib/routes/musd-btc-lp/spike.ts`, `web/src/lib/routes/musd-btc-lp/receipt.ts`
- Create: `web/src/lib/tx/errors.ts`, `web/src/lib/tx/safe.ts`, `web/src/lib/tx/send.ts`
- Modify: `web/package.json` (script `sync-abi`)
- Test: `web/src/lib/quote/amount.test.ts`, `web/src/lib/routes/musd-btc-lp/spike.test.ts`, `web/src/lib/routes/musd-btc-lp/receipt.test.ts`, `web/src/lib/tx/errors.test.ts`, `web/src/lib/tx/safe.test.ts`, `web/src/lib/tx/send.test.ts`

**Interfaces:**
- Consumes: `testnet` (Task 1).
- Produces:
  - `mezoRouteExecutorAbi` (const ABI generated from `contracts/out`), `routerAbi` (`getAmountsOut(uint256, Route[])`).
  - `parseMusdAmount(input: string): bigint | null`.
  - `type EnterParams = { musdIn; musdToSwap; minBtcFromSwap; minMusdAdded; minBtcAdded; minLpOut; deadline: bigint; recipient: Address }`, `NO_PERMIT`, `DEADLINE_SECONDS = 600n`, `SPIKE_SLIPPAGE_BPS = 100n`, `netOfFee(musdIn, feeBps): bigint`, `spikeSwapAmount(musdIn, feeBps): bigint`, `buildSpikeEnterParams({ musdIn, feeBps, btcOutQuote, recipient, nowSeconds }): EnterParams`, `encodeEnterCall(params): Hex`, `encodeApproveCall(spender, amount): Hex`, `type EnterBlocker`, `ENTER_BLOCKER_MESSAGES`, `enterBlocker({ amount, chainId, onchainFeeBps, musdBalance, gasBalance, maxMusdIn }): EnterBlocker | null`, `needsApproval(allowance, amount): boolean`.
  - `type EnteredEvent`, `findEnteredEvent(logs, executor): EnteredEvent | null`.
  - `RelayError`, `SmartAccountCallFailedError`, `classifySendError(error): { kind: "rejected" | "needs-gas" | "relay" | "reverted" | "unknown"; message: string }`.
  - `SAFE_EXECUTION_FAILURE_TOPIC`, `hasSafeExecutionFailure(logs): boolean`.
  - `assertTxHash(value: unknown): Hash`, `sendCall(config: Config, call: { to: Address; data: Hex }): Promise<TransactionReceipt>`.

- [ ] **Step 1: Generate the executor ABI from the Foundry build**

`web/scripts/sync-abi.mjs`:

```js
// Copies the MezoRouteExecutor ABI from the Foundry build into a typed module.
// Re-run after any contract change: `cd contracts && forge build`, then `npm run sync-abi` in web/.
import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../../contracts/out/MezoRouteExecutor.sol/MezoRouteExecutor.json", import.meta.url);
const target = new URL("../src/lib/abi/mezoRouteExecutor.ts", import.meta.url);
const { abi } = JSON.parse(readFileSync(source, "utf8"));
writeFileSync(
  target,
  `// Generated by scripts/sync-abi.mjs from contracts/out. Do not edit.\nexport const mezoRouteExecutorAbi = ${JSON.stringify(abi, null, 2)} as const;\n`,
);
console.log(`sync-abi: wrote ${abi.length} ABI entries`);
```

Add to `"scripts"` in `web/package.json`: `"sync-abi": "node scripts/sync-abi.mjs"`. Then:

```bash
cd /Users/vanhuy/Desktop/mezoroute/contracts && forge build
cd ../web && npm run sync-abi
```

Expected: `sync-abi: wrote 31 ABI entries` (constructor, 13 functions, 2 events, 15 errors).

`web/src/lib/abi/router.ts`:

```ts
import { parseAbi } from "viem";

/** Tigris Router read used for the spike's swap quote (spec §11.1 Basic Router). */
export const routerAbi = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
]);
```

- [ ] **Step 2: Write the failing amount tests**

`web/src/lib/quote/amount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMusdAmount } from "./amount";

describe("parseMusdAmount", () => {
  it.each([
    ["1.5", 1_500000000000000000n],
    [" 20 ", 20_000000000000000000n],
    [".5", 500000000000000000n],
    ["1.", 1_000000000000000000n],
    ["0.000000000000000001", 1n],
    ["1000000", 1_000_000_000000000000000000n],
  ])("parses %j", (input, expected) => {
    expect(parseMusdAmount(input)).toBe(expected);
  });

  it.each(["", ".", "0", "0.000", "abc", "-1", "1e3", "1,5", "1.1234567890123456789"])("rejects %j", (input) => {
    expect(parseMusdAmount(input)).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/quote/amount.test.ts`
Expected: FAIL — `Failed to resolve import "./amount"`.

- [ ] **Step 4: Implement amount parsing**

`web/src/lib/quote/amount.ts`:

```ts
import { parseUnits } from "viem";

// Optional integer part, optional fraction of at most 18 digits (MUSD has 18 decimals).
const DECIMAL = /^(\d+)?(?:\.(\d{0,18}))?$/;

/** Parses a typed MUSD amount. Returns null for empty, malformed, over-precise, or zero input. */
export function parseMusdAmount(input: string): bigint | null {
  const match = DECIMAL.exec(input.trim());
  if (!match || (match[1] === undefined && !match[2])) return null;
  const amount = parseUnits(`${match[1] ?? "0"}.${match[2] || "0"}`, 18);
  return amount > 0n ? amount : null;
}
```

- [ ] **Step 5: Run the amount tests to make sure they pass**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/quote/amount.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Write the failing entry-params tests**

The numbers come from the live smoke `enter` of 2 Oct 2026 (tx `0x5f17df95…87bf`): 20 MUSD at 10 bps swapped exactly `9.99` MUSD, and the swap returned `126791217068156` wei BTC.

`web/src/lib/routes/musd-btc-lp/spike.test.ts`:

```ts
import { decodeFunctionData, erc20Abi, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { testnet } from "@/lib/config/testnet";
import {
  buildSpikeEnterParams,
  encodeApproveCall,
  encodeEnterCall,
  enterBlocker,
  needsApproval,
  netOfFee,
  NO_PERMIT,
  spikeSwapAmount,
} from "./spike";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const MUSD_20 = 20_000000000000000000n;

describe("spike entry params", () => {
  it("charges the fee before splitting, as the contract does (spec 11.3 step 5)", () => {
    expect(netOfFee(MUSD_20, 10n)).toBe(19_980000000000000000n);
    expect(spikeSwapAmount(MUSD_20, 10n)).toBe(9_990000000000000000n);
  });

  it("matches the live smoke entry and sets a 1% swap minimum and a 600 s deadline", () => {
    const params = buildSpikeEnterParams({
      musdIn: MUSD_20,
      feeBps: 10n,
      btcOutQuote: 126791217068156n,
      recipient: ME,
      nowSeconds: 1_790_900_000n,
    });
    expect(params).toEqual({
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 125523304897474n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: 1_790_900_600n,
      recipient: ME,
    });
  });

  it("encodes enter(params, zero permit) with the deployed selector", () => {
    const params = buildSpikeEnterParams({
      musdIn: MUSD_20,
      feeBps: 10n,
      btcOutQuote: 1n,
      recipient: ME,
      nowSeconds: 0n,
    });
    const data = encodeEnterCall(params);
    expect(data.slice(0, 10)).toBe("0x92359033");
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data });
    expect(decoded.functionName).toBe("enter");
    expect(decoded.args).toEqual([params, { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash }]);
    expect(NO_PERMIT.value).toBe(0n);
  });

  it("encodes an exact approval to the executor", () => {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: encodeApproveCall(testnet.addresses.executor, 5n) });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([testnet.addresses.executor, 5n]);
  });
});

describe("enterBlocker", () => {
  const ok = {
    amount: 10n,
    chainId: 31611,
    onchainFeeBps: 10n,
    musdBalance: 10n,
    gasBalance: 1n,
    maxMusdIn: 10n,
  };

  it("allows amounts equal to the balance and to the cap", () => {
    expect(enterBlocker(ok)).toBeNull();
  });

  // Expected value first: test titles format it with %s (JSON formatting cannot print bigint).
  it.each([
    ["wrong-network", { chainId: 1 }],
    ["wrong-network", { chainId: undefined }],
    ["config-mismatch", { onchainFeeBps: 50n }],
    ["enter-amount", { amount: null }],
    ["needs-gas", { gasBalance: 0n }],
    ["insufficient-musd", { musdBalance: 9n }],
    ["above-cap", { maxMusdIn: 9n }],
  ] as const)("returns %s", (expected, override) => {
    expect(enterBlocker({ ...ok, ...override })).toBe(expected);
  });

  it("reports the network before anything else", () => {
    expect(enterBlocker({ ...ok, chainId: 1, amount: null, gasBalance: 0n })).toBe("wrong-network");
  });
});

describe("needsApproval", () => {
  it("skips the approval when the allowance already covers the amount", () => {
    expect(needsApproval(10n, 10n)).toBe(false);
    expect(needsApproval(9n, 10n)).toBe(true);
  });
});
```

- [ ] **Step 7: Run them to make sure they fail**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/routes/musd-btc-lp/spike.test.ts`
Expected: FAIL — `Failed to resolve import "./spike"`.

- [ ] **Step 8: Implement the entry params**

`web/src/lib/routes/musd-btc-lp/spike.ts`:

```ts
import { encodeFunctionData, erc20Abi, zeroHash, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { testnet } from "@/lib/config/testnet";

export type EnterParams = {
  musdIn: bigint;
  musdToSwap: bigint;
  minBtcFromSwap: bigint;
  minMusdAdded: bigint;
  minBtcAdded: bigint;
  minLpOut: bigint;
  deadline: bigint;
  recipient: Address;
};

/** Permit with value 0: the executor skips the permit and uses the existing allowance (spec 11.2). */
export const NO_PERMIT = { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash } as const;

/** Transaction deadline, now + 10 minutes (spec §12). */
export const DEADLINE_SECONDS = 600n;
/** Default slippage, 1% (spec §12). */
export const SPIKE_SLIPPAGE_BPS = 100n;

export function netOfFee(musdIn: bigint, feeBps: bigint): bigint {
  return musdIn - (musdIn * feeBps) / 10_000n;
}

/**
 * S1 only: swap half of the post-fee amount, like the testnet smoke script. The optimal-swap
 * quote engine with full minimums (spec §12, task F3) replaces this.
 */
export function spikeSwapAmount(musdIn: bigint, feeBps: bigint): bigint {
  return netOfFee(musdIn, feeBps) / 2n;
}

export function buildSpikeEnterParams(input: {
  musdIn: bigint;
  feeBps: bigint;
  btcOutQuote: bigint;
  recipient: Address;
  nowSeconds: bigint;
}): EnterParams {
  return {
    musdIn: input.musdIn,
    musdToSwap: spikeSwapAmount(input.musdIn, input.feeBps),
    minBtcFromSwap: (input.btcOutQuote * (10_000n - SPIKE_SLIPPAGE_BPS)) / 10_000n,
    minMusdAdded: 0n,
    minBtcAdded: 0n,
    minLpOut: 0n,
    deadline: input.nowSeconds + DEADLINE_SECONDS,
    recipient: input.recipient,
  };
}

export function encodeEnterCall(params: EnterParams): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "enter", args: [params, NO_PERMIT] });
}

export function encodeApproveCall(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export type EnterBlocker =
  | "wrong-network"
  | "config-mismatch"
  | "enter-amount"
  | "needs-gas"
  | "insufficient-musd"
  | "above-cap";

export const ENTER_BLOCKER_MESSAGES: Record<EnterBlocker, string> = {
  "wrong-network": "MezoRoute executes on Mezo Testnet.",
  "config-mismatch": "The executor on chain does not match this app's pinned fee.",
  "enter-amount": "Enter an MUSD amount.",
  "needs-gas": "You need test BTC to submit transactions.",
  "insufficient-musd": "Amount exceeds your available MUSD.",
  "above-cap": "Amount is above the executor's per-transaction cap.",
};

/** First reason the entry cannot be sent, in the order the user should fix them (spec FR-01, FR-05, FR-22). */
export function enterBlocker(state: {
  amount: bigint | null;
  chainId: number | undefined;
  onchainFeeBps: bigint;
  musdBalance: bigint;
  gasBalance: bigint;
  maxMusdIn: bigint;
}): EnterBlocker | null {
  if (state.chainId !== testnet.chainId) return "wrong-network";
  if (state.onchainFeeBps !== testnet.executorFeeBps) return "config-mismatch";
  if (state.amount === null) return "enter-amount";
  if (state.gasBalance === 0n) return "needs-gas";
  if (state.amount > state.musdBalance) return "insufficient-musd";
  if (state.amount > state.maxMusdIn) return "above-cap";
  return null;
}

export function needsApproval(allowance: bigint, amount: bigint): boolean {
  return allowance < amount;
}
```

- [ ] **Step 9: Run the entry-params tests to make sure they pass**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/routes/musd-btc-lp/spike.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 10: Write the failing receipt test**

The fixture is the executor log from the live smoke `enter` (tx `0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf`, block `0xf2a932`), exactly as the RPC returned it.

`web/src/lib/routes/musd-btc-lp/receipt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findEnteredEvent } from "./receipt";

const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const enteredLog = {
  address: "0xb36b2e012003840951cff00fa6b1e3237a110920",
  topics: [
    "0x0a8e6314ed63e6d6ee27c3a46be2a5baa330bf1a4fa3ce4729fef4209d88279a",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
  ],
  data: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001158e460913d0000000000000000000000000000000000000000000000000000000470de4df8200000000000000000000000000000000000000000000000000008aa39c121a27000000000000000000000000000000000000000000000000000000007350e174387c0000000000000000000000000000000000000000000000008a956a9d26512d1300000000000000000000000000000000000000000000000000007350e174387c000000000000000000000000000000000000000000000000007e69be0f4ae255000000000000000000000000000000000000000000000000000e3174f3d5d2ed0000000000000000000000000000000000000000000000000000000000000000",
} as const;

describe("findEnteredEvent", () => {
  it("decodes the live smoke Entered event", () => {
    expect(findEnteredEvent([enteredLog], EXECUTOR)).toEqual({
      caller: ME,
      recipient: ME,
      musdBorrowed: 0n,
      musdIn: 20000000000000000000n,
      fee: 20000000000000000n,
      musdSwapped: 9990000000000000000n,
      btcFromSwap: 126791217068156n,
      musdAdded: 9986004971949206803n,
      btcAdded: 126791217068156n,
      liquidityOut: 35582112086811221n,
      musdRefund: 3995028050793197n,
      btcRefund: 0n,
    });
  });

  it("ignores the same event emitted by another contract", () => {
    const spoofed = { ...enteredLog, address: "0x0000000000000000000000000000000000000001" } as const;
    expect(findEnteredEvent([spoofed], EXECUTOR)).toBeNull();
  });

  it("returns null when the receipt has no Entered event", () => {
    expect(findEnteredEvent([], EXECUTOR)).toBeNull();
  });
});
```

- [ ] **Step 11: Run it to make sure it fails**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/routes/musd-btc-lp/receipt.test.ts`
Expected: FAIL — `Failed to resolve import "./receipt"`.

- [ ] **Step 12: Implement receipt decoding**

`web/src/lib/routes/musd-btc-lp/receipt.ts`:

```ts
import { decodeEventLog, isAddressEqual, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";

export type EnteredEvent = {
  caller: Address;
  recipient: Address;
  musdBorrowed: bigint;
  musdIn: bigint;
  fee: bigint;
  musdSwapped: bigint;
  btcFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidityOut: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
};

type LogLike = { address: Address; topics: readonly Hex[]; data: Hex };

/** The executor's `Entered` event from a receipt; receipts show only event values (spec FR-11). */
export function findEnteredEvent(logs: readonly LogLike[], executor: Address): EnteredEvent | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, executor) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: mezoRouteExecutorAbi,
        eventName: "Entered",
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      return decoded.args as EnteredEvent;
    } catch {
      // Another executor event (e.g. Exited); keep looking.
    }
  }
  return null;
}
```

- [ ] **Step 13: Run the receipt test to make sure it passes**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/routes/musd-btc-lp/receipt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 14: Write the failing transaction tests**

`web/src/lib/tx/safe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasSafeExecutionFailure, SAFE_EXECUTION_FAILURE_TOPIC } from "./safe";

describe("hasSafeExecutionFailure", () => {
  it("uses the ExecutionFailure(bytes32,uint256) topic", () => {
    expect(SAFE_EXECUTION_FAILURE_TOPIC).toBe("0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23");
  });

  it("flags a relayed transaction whose inner call reverted", () => {
    expect(hasSafeExecutionFailure([{ topics: [SAFE_EXECUTION_FAILURE_TOPIC] }])).toBe(true);
  });

  it("passes ExecutionSuccess and ordinary logs", () => {
    const success = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";
    expect(hasSafeExecutionFailure([{ topics: [success] }, { topics: [] }])).toBe(false);
  });
});
```

`web/src/lib/tx/send.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RelayError } from "./errors";
import { assertTxHash } from "./send";

describe("assertTxHash", () => {
  it("accepts a 32-byte hash", () => {
    const hash = "0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf";
    expect(assertTxHash(hash)).toBe(hash);
  });

  it.each(["0x", "", undefined, null, "0x1234"])("rejects %j as a relay failure", (value) => {
    expect(() => assertTxHash(value)).toThrow(RelayError);
  });
});
```

`web/src/lib/tx/errors.test.ts`:

```ts
import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { classifySendError, RelayError, SmartAccountCallFailedError } from "./errors";

describe("classifySendError", () => {
  it("maps relay failures", () => {
    expect(classifySendError(new RelayError("no hash")).kind).toBe("relay");
  });

  it("maps a rejected EVM signature (spec 13)", () => {
    expect(classifySendError(new UserRejectedRequestError(new Error("User rejected the request.")))).toEqual({
      kind: "rejected",
      message: "Transaction was not signed.",
    });
  });

  it("finds a Bitcoin-wallet rejection in the cause chain", () => {
    const error = new Error("Failed to send", { cause: new Error("User rejected the request.") });
    expect(classifySendError(error).kind).toBe("rejected");
  });

  it("maps OrangeKit's empty-Safe error to needs-gas (spec 13)", () => {
    const error = new Error(
      "Not enough native token balance to cover transaction gas. Required: 146000 sats. Current balance: 0 sats.",
    );
    expect(classifySendError(error)).toEqual({
      kind: "needs-gas",
      message: "You need test BTC to submit transactions.",
    });
  });

  it("maps a reverted smart-account call", () => {
    expect(classifySendError(new SmartAccountCallFailedError("0xabc")).kind).toBe("reverted");
  });

  it("falls back to the error message", () => {
    expect(classifySendError(new Error("boom"))).toEqual({ kind: "unknown", message: "boom" });
    expect(classifySendError("weird")).toEqual({ kind: "unknown", message: "weird" });
  });
});
```

- [ ] **Step 15: Run them to make sure they fail**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npx vitest run src/lib/tx`
Expected: FAIL — imports of `./safe`, `./send`, `./errors` do not resolve.

- [ ] **Step 16: Implement the transaction helpers**

`web/src/lib/tx/errors.ts`:

```ts
/** The relayer answered without a usable transaction hash, so nothing was submitted. */
export class RelayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelayError";
  }
}

/** The relayed Safe transaction confirmed, but the call inside it reverted (Safe ExecutionFailure). */
export class SmartAccountCallFailedError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(`The smart-account call reverted inside relayed transaction ${hash}`);
    this.name = "SmartAccountCallFailedError";
    this.hash = hash;
  }
}

export type SendErrorKind = "rejected" | "needs-gas" | "relay" | "reverted" | "unknown";

function messageChain(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 6; depth++) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages;
}

/** Minimal mapping for the spike; F1 builds the full decoder (spec §13). */
export function classifySendError(error: unknown): { kind: SendErrorKind; message: string } {
  if (error instanceof RelayError) {
    return { kind: "relay", message: "Mezo's relayer did not accept the transaction. Retry in a moment." };
  }
  if (error instanceof SmartAccountCallFailedError) {
    return { kind: "reverted", message: "Your smart account sent the transaction, but the call reverted." };
  }
  const messages = messageChain(error);
  const text = messages.join(" | ");
  if (/user rejected|user denied|rejected the request|cancel/i.test(text)) {
    return { kind: "rejected", message: "Transaction was not signed." };
  }
  if (/not enough native token balance|insufficient funds/i.test(text)) {
    return { kind: "needs-gas", message: "You need test BTC to submit transactions." };
  }
  return { kind: "unknown", message: messages[0] ?? String(error) };
}
```

`web/src/lib/tx/safe.ts`:

```ts
import { toEventSelector, type Hex } from "viem";

/**
 * Safe emits ExecutionFailure (instead of reverting) when the inner call fails and safeTxGas or
 * gasPrice is non-zero, which OrangeKit always sets. The relayed transaction then has status success.
 */
export const SAFE_EXECUTION_FAILURE_TOPIC = toEventSelector("ExecutionFailure(bytes32,uint256)");

export function hasSafeExecutionFailure(logs: readonly { topics: readonly Hex[] }[]): boolean {
  return logs.some((log) => log.topics[0]?.toLowerCase() === SAFE_EXECUTION_FAILURE_TOPIC);
}
```

`web/src/lib/tx/send.ts`:

```ts
import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { RelayError, SmartAccountCallFailedError } from "./errors";
import { hasSafeExecutionFailure } from "./safe";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Mezo's relayer reports failure as hash "0x" instead of throwing (OrangeKit MezoTransactionSender). */
export function assertTxHash(value: unknown): Hash {
  if (typeof value !== "string" || !TX_HASH.test(value)) {
    throw new RelayError(`The wallet returned no transaction hash (${String(value)}); nothing was submitted.`);
  }
  return value as Hash;
}

/**
 * Sends one call from the connected wallet and waits for a successful receipt. The same path
 * serves EOAs and OrangeKit smart accounts: wagmi resolves `sendTransaction` to OrangeKit's
 * Safe-relaying override for Bitcoin wallets.
 */
export async function sendCall(config: Config, call: { to: Address; data: Hex }): Promise<TransactionReceipt> {
  const hash = assertTxHash(await sendTransaction(config, { to: call.to, data: call.data }));
  // The public testnet RPC intermittently returns null receipts; viem keeps polling until the timeout.
  const receipt = await waitForTransactionReceipt(config, { hash, pollingInterval: 2_000, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  if (hasSafeExecutionFailure(receipt.logs)) throw new SmartAccountCallFailedError(hash);
  return receipt;
}
```

- [ ] **Step 17: Run the whole suite, the build, and the lint**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npm test && npm run build`
Expected: all tests PASS (config 9, patch 3, installed 2, capabilities 6, amount 15, spike 14, receipt 3, safe 3, send 6, errors 6 = 67); the build passes type checking and lint.

- [ ] **Step 18: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # feat/s1-passport-spike
git status --short           # no duplicates
git add web/scripts/sync-abi.mjs web/package.json web/src/lib
git commit -m "feat(web): add entry params, receipt decoding, and relayed-transaction checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Approve + enter panel, verified with an EVM wallet on testnet

**Files:**
- Create: `web/src/app/_spike/EnterPanel.tsx`
- Modify: `web/src/app/_spike/Spike.tsx`

**Interfaces:**
- Consumes: `testnet`, `explorerTxUrl` (Task 1); `mezoRouteExecutorAbi`, `routerAbi`, `parseMusdAmount`, `buildSpikeEnterParams`, `spikeSwapAmount`, `encodeApproveCall`, `encodeEnterCall`, `enterBlocker`, `ENTER_BLOCKER_MESSAGES`, `needsApproval`, `findEnteredEvent`, `EnteredEvent`, `classifySendError`, `sendCall` (Task 4).
- Produces: `EnterPanel` component (reads balance, allowance, fee, cap; approves the exact amount when needed; sends `enter`; shows `Entered` values and an explorer link).

- [ ] **Step 1: Write the panel**

`web/src/app/_spike/EnterPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { erc20Abi, formatUnits, type TransactionReceipt } from "viem";
import { useAccount, useBalance, useConfig, useReadContracts } from "wagmi";
import { readContract } from "wagmi/actions";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { routerAbi } from "@/lib/abi/router";
import { explorerTxUrl, testnet } from "@/lib/config/testnet";
import { parseMusdAmount } from "@/lib/quote/amount";
import { findEnteredEvent, type EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import {
  buildSpikeEnterParams,
  encodeApproveCall,
  encodeEnterCall,
  ENTER_BLOCKER_MESSAGES,
  enterBlocker,
  needsApproval,
  spikeSwapAmount,
} from "@/lib/routes/musd-btc-lp/spike";
import { classifySendError } from "@/lib/tx/errors";
import { sendCall } from "@/lib/tx/send";

const { musd, btc, router, poolFactory, executor } = testnet.addresses;

type Step =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "done"; receipt: TransactionReceipt; entered: EnteredEvent | null }
  | { kind: "error"; message: string };

export function EnterPanel() {
  const config = useConfig();
  const { address, chainId } = useAccount();
  const [input, setInput] = useState("1");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const amount = parseMusdAmount(input);

  const reads = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: musd, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: musd, abi: erc20Abi, functionName: "allowance", args: [address!, executor] },
      { address: executor, abi: mezoRouteExecutorAbi, functionName: "feeBps" },
      { address: executor, abi: mezoRouteExecutorAbi, functionName: "maxMusdIn" },
    ],
    query: { enabled: Boolean(address) },
  });
  const gas = useBalance({ address, query: { enabled: Boolean(address) } });

  if (!address) return null;
  if (!reads.data || !gas.data) return <p className="text-sm text-slate-600">Reading balances…</p>;

  const owner = address;
  const [musdBalance, allowance, onchainFeeBps, maxMusdIn] = reads.data;
  const blocker = enterBlocker({ amount, chainId, onchainFeeBps, musdBalance, gasBalance: gas.data.value, maxMusdIn });
  const busy = step.kind === "busy";

  async function run() {
    if (amount === null || blocker !== null) return;
    try {
      if (needsApproval(allowance, amount)) {
        setStep({ kind: "busy", label: "Approving the exact MUSD amount…" });
        await sendCall(config, { to: musd, data: encodeApproveCall(executor, amount) });
      }
      setStep({ kind: "busy", label: "Quoting the swap…" });
      const amounts = await readContract(config, {
        address: router,
        abi: routerAbi,
        functionName: "getAmountsOut",
        args: [spikeSwapAmount(amount, testnet.executorFeeBps), [{ from: musd, to: btc, stable: false, factory: poolFactory }]],
      });
      const params = buildSpikeEnterParams({
        musdIn: amount,
        feeBps: testnet.executorFeeBps,
        btcOutQuote: amounts[1],
        recipient: owner,
        nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
      });
      setStep({ kind: "busy", label: "Sending enter…" });
      const receipt = await sendCall(config, { to: executor, data: encodeEnterCall(params) });
      setStep({ kind: "done", receipt, entered: findEnteredEvent(receipt.logs, executor) });
    } catch (error) {
      console.error(error);
      setStep({ kind: "error", message: classifySendError(error).message });
    } finally {
      await Promise.all([reads.refetch(), gas.refetch()]);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Approve + enter (testnet)</h2>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>MUSD balance</dt>
        <dd>{formatUnits(musdBalance, 18)}</dd>
        <dt>Allowance to executor</dt>
        <dd>{formatUnits(allowance, 18)}</dd>
        <dt>Executor fee</dt>
        <dd>
          {onchainFeeBps.toString()} bps (pinned {testnet.executorFeeBps.toString()})
        </dd>
        <dt>Per-tx cap</dt>
        <dd>{formatUnits(maxMusdIn, 18)} MUSD</dd>
      </dl>
      <label className="block text-sm">
        MUSD amount
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          inputMode="decimal"
          value={input}
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
        />
      </label>
      {blocker && <p className="text-sm text-amber-700">{ENTER_BLOCKER_MESSAGES[blocker]}</p>}
      <button
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-40"
        disabled={busy || blocker !== null}
        onClick={run}
      >
        {amount !== null && needsApproval(allowance, amount) ? "Approve, then enter" : "Enter"}
      </button>
      {step.kind === "busy" && <p className="text-sm">{step.label}</p>}
      {step.kind === "error" && <p className="text-sm text-red-700">{step.message}</p>}
      {step.kind === "done" && <EnteredSummary receipt={step.receipt} entered={step.entered} />}
    </section>
  );
}

function EnteredSummary({ receipt, entered }: { receipt: TransactionReceipt; entered: EnteredEvent | null }) {
  const link = (
    <a className="break-all text-indigo-700 underline" href={explorerTxUrl(receipt.transactionHash)} target="_blank" rel="noreferrer">
      {receipt.transactionHash}
    </a>
  );
  if (!entered) return <p className="text-sm text-red-700">Confirmed, but no Entered event was found: {link}</p>;
  return (
    <div className="space-y-1 text-sm">
      <p>Entered (event values): {link}</p>
      <ul className="list-disc pl-5">
        <li>
          MUSD in {formatUnits(entered.musdIn, 18)}, fee {formatUnits(entered.fee, 18)}
        </li>
        <li>
          Swapped {formatUnits(entered.musdSwapped, 18)} MUSD for {formatUnits(entered.btcFromSwap, 18)} BTC
        </li>
        <li>LP minted {formatUnits(entered.liquidityOut, 18)}</li>
        <li>
          Refund {formatUnits(entered.musdRefund, 18)} MUSD and {formatUnits(entered.btcRefund, 18)} BTC
        </li>
        <li>Caller {entered.caller}</li>
        <li>Gas used {receipt.gasUsed.toString()}</li>
      </ul>
    </div>
  );
}
```

Replace `web/src/app/_spike/Spike.tsx`:

```tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { EnterPanel } from "./EnterPanel";
import { WalletInfo } from "./WalletInfo";

export default function Spike() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">MezoRoute · S1 spike</h1>
        <ConnectButton />
      </header>
      <WalletInfo />
      <EnterPanel />
    </main>
  );
}
```

- [ ] **Step 2: Build, lint, and test**

Run: `cd /Users/vanhuy/Desktop/mezoroute/web && npm test && npm run build && echo OK`
Expected: 67 tests PASS and the build prints `OK`.

- [ ] **Step 3: Fund the EVM test account**

Ask the user for the MetaMask address they will test with (`EVM_ADDR`). If it holds less than 0.0001 BTC or less than 2 MUSD on testnet, fund it from the deployer key:

```bash
cd /Users/vanhuy/Desktop/mezoroute/contracts
set -a && source .env && set +a
RPC=https://rpc.test.mezo.org
TO=<EVM_ADDR>
cast send "$TO" --value 0.0001ether --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --async
cast send 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 "transfer(address,uint256)" "$TO" 5000000000000000000 \
  --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --async
# Poll each printed hash until status is 1 (the public RPC can return null receipts for a while):
cast receipt <hash> status --rpc-url "$RPC"
```

- [ ] **Step 4: Run approve + enter with MetaMask on localhost**

Record the executor balances first:

```bash
for t in 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 0x7b7C000000000000000000000000000000000000 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9; do
  cast call $t "balanceOf(address)(uint256)" 0xB36B2E012003840951CFf00fA6b1E3237A110920 --rpc-url https://rpc.test.mezo.org
done
```

Start `npm run dev` in `web/`. Ask the user to open `http://localhost:3000`, connect MetaMask (accept the network switch), keep the amount at `1`, click **Approve, then enter**, and sign both transactions. Expected: the panel shows the `Entered` values (MUSD in 1.0, fee 0.001), a working explorer link, and `Caller` equal to the MetaMask address. Then re-run the balance loop above: the executor balances must be unchanged (spec §11.8 invariant 7). Write down both transaction hashes for the findings.

If it fails, record the panel message and the browser console error, then fix only defects in our code (for example a wrong argument shape) with a failing unit test first. Library or relayer behaviour is a finding, not something to patch around in this task.

- [ ] **Step 5: Commit**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # feat/s1-passport-spike
git status --short           # no duplicates
git add web/src/app/_spike
git commit -m "feat(web): approve and enter from the connected wallet on testnet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Vercel preview, Bitcoin-wallet run, findings, and spec update

**Files:**
- Create: `docs/spikes/s1-passport-static-export.md`
- Modify: `PRODUCT_SPEC.md` (§4, §7 Flow A, §9, §10, §16, §18), `CLAUDE.md` (new "Frontend (`web/`)" section)

**Interfaces:**
- Consumes: everything above.
- Produces: a Vercel preview URL, a findings document with live transaction hashes, and spec/CLAUDE.md text that F1 builds on.

- [ ] **Step 1: Create the Vercel project and deploy a preview**

```bash
cd /Users/vanhuy/Desktop/mezoroute/web
vercel project add mezoroute
vercel link --yes --project mezoroute
vercel deploy --yes --build-env NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="$(sed -n 's/^NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=//p' .env.local)"
```

Expected: the build log shows `patch-relayer: …` lines and `○ /` static; the command prints a `https://mezoroute-*.vercel.app` preview URL. `curl -s -o /dev/null -w "%{http_code}\n" <url>` returns `200`, or `401` if Vercel Deployment Protection is on; record which. `web/.vercel/` is git-ignored.

- [ ] **Step 2: Repeat the EVM run on the preview**

Ask the user to open the preview URL, connect MetaMask, and enter `1` MUSD again (allowance is 0 after the first run, so it approves again). Expected: the same result as Task 5 Step 4. Record the hashes.

- [ ] **Step 3: Fund the Bitcoin wallet's smart account**

Ask the user to connect their Bitcoin wallet on the preview and read the **Mezo account** (the predicted Safe address, `SAFE`) from `WalletInfo`. Check that `WalletInfo` shows kind `smart-account` and `permit no` while the Safe is still undeployed (`cast code <SAFE> --rpc-url https://rpc.test.mezo.org` prints `0x`). Fund it exactly as in Task 5 Step 3 with `TO=<SAFE>` (0.0001 BTC and 5 MUSD).

- [ ] **Step 4: Run approve + enter with the Bitcoin wallet**

Record the executor balances (loop from Task 5 Step 4). Ask the user to enter `1` MUSD and click **Approve, then enter**. The Bitcoin wallet asks for message signatures: one per Safe transaction, and possibly another for the Safe deployment on the first transaction. Expected: the panel shows the `Entered` values with `Caller` equal to `SAFE`, and the explorer shows a relayer transaction calling `execTransaction` on the Safe. Afterwards `cast code <SAFE>` is non-empty and the executor balances are unchanged. Record every hash, the number of signature prompts, and how long each relay took.

If it fails, record the panel message and console output, and ask the user for the response body of the `testnet.mezo.org/api/v2/relay/…` request from the browser's Network tab (the relayer explains rejections there, e.g. a refund-receiver mismatch). If the relayer names a different refund receiver, extend `patchRelayerSource` with that replacement, test first, and retry once. If the Bitcoin path still fails, apply the spec §18 fallback: Passport for EVM wallets only, with Bitcoin-wallet support documented as the next milestone.

- [ ] **Step 5: Write the findings document**

Create `docs/spikes/s1-passport-static-export.md` with these sections. Fill each value from what was observed in Tasks 1–6; write "not observed" rather than guessing.

```markdown
# S1 spike — Mezo Passport + Next.js static export (results)

Date: <execution date> · Branch: feat/s1-passport-spike · Preview: <url> (protection: <on/off>)

## Verdict
<One paragraph: EVM path works / fails; Bitcoin path works / fails; what F1 uses.>

## Stack as installed
- next 14.2.35, react 18.3.1, @mezo-org/passport 0.17.2, @rainbow-me/rainbowkit 2.0.2, wagmi 2.19.5, viem 2.57.2
- `npm ls` duplicates: <none / list>
- legacy-peer-deps needed: <yes, because … / no>
- First Load JS for `/`: <kB>

## Static export
- `next build` with `output: "export"`: <ok / issues and fixes>
- Wallet tree rendered client-only via `next/dynamic` (`ssr: false`).
- `/tx/[hash]` cannot be prerendered; F1 uses `/tx/?hash=0x…`.

## EVM wallet (MetaMask)
| Step | Local | Preview |
|---|---|---|
| Connect, kind | | |
| Approve tx | | |
| Enter tx | | |
| Entered values | | |
| Executor balances unchanged | | |

## Bitcoin wallet (<Unisat/OKX/Xverse>, <address type>)
| Step | Result |
|---|---|
| Connect, Safe address, kind before deployment | |
| Funding txs | |
| Safe deployment tx | |
| Approve tx (relayed) | |
| Enter tx (relayed), Entered.caller | |
| Signature prompts / relay latency | |
| Executor balances unchanged | |

## Relayer
- Endpoint: https://testnet.mezo.org/api/v2/relay/ (Passport's test.mezo.org is dead; patched by web/scripts/patch-relayer.mjs)
- Refund receiver accepted: <yes / no, response …>
- wagmi `sendTransaction` reached OrangeKit's override: <yes / no>

## Decisions for F1
- Wallet kind: OrangeKit connector first, `getCode` second (`web/src/lib/wallet/capabilities.ts`).
- Smart-account receipts: fail on Safe `ExecutionFailure`; relayer `"0x"` hash is a relay error.
- Wallet list: Bitcoin (Unisat, OKX, Xverse) + Ethereum (MetaMask, WalletConnect, injected).
- Network switch (F1): Passport's `getConfig` builds one network per config, so switching rebuilds the wagmi config.
- <anything else observed>

## Reported upstream
- <Discord/GitHub link if the dead test.mezo.org relayer was reported to Mezo, else "not yet">
```

- [ ] **Step 6: Update the spec with what was confirmed**

Apply only the edits the run confirmed:

1. §4 table — append these rows (adjust the evidence column to what was observed):

```markdown
| Passport 0.17.2 (OrangeKit smart-account 1.0.0-beta.24) relays testnet transactions through `test.mezo.org`, which Cloudflare rejects; `testnet.mezo.org/api/v2/relay/*` is live and allows CORS from any origin | `curl` 3 Oct 2026; S1 relayed transactions (`docs/spikes/s1-passport-static-export.md`) | `web/scripts/patch-relayer.mjs` rewrites the endpoint after every install |
| A Bitcoin wallet's Safe is deployed on its first transaction, so `getCode` is empty before that | OrangeKit `ensureSafeForBtcWallet`; S1 run | Wallet kind comes from the connector (OrangeKit) first, `getCode` second |
| A relayed Safe transaction confirms even when the inner call reverts (`ExecutionFailure`), and a rejected relay returns hash `"0x"` | Safe `execTransaction` with non-zero `safeTxGas`; OrangeKit `MezoTransactionSender` | Smart-account receipts check `ExecutionFailure`; a malformed hash is a relay error |
```

2. §4 Passport row: append "; wagmi is pinned to 2.x (wagmi 3 is outside Passport's peer range) and RainbowKit to Passport's exact 2.0.2".
3. §7 Flow A step 1: replace "the app detects whether the account is an EOA or a smart account (`getCode`)" with "the app detects whether the account is an EOA or a smart account (OrangeKit connector first, then `getCode`)".
4. §9 table, page 4: route `/tx/[hash]` → `/tx/?hash=0x…` and add to its Content cell "(static export cannot prerender dynamic segments)".
5. §10 Stack, Frontend line: "`@mezo-org/passport` 0.17.2 (RainbowKit 2.0.2), wagmi 2 (pinned; Passport does not support wagmi 3), viem 2, …".
6. §16, under "Wave 1 — Done": add `S1 done <date>: <one-line verdict>; findings in docs/spikes/s1-passport-static-export.md.`
7. §18 Passport risk row: append the outcome ("S1: Bitcoin wallets work on testnet via the patched relayer", or "S1: fallback applied — EVM wallets only").

- [ ] **Step 7: Document the frontend in CLAUDE.md**

Add after the Contracts section of `CLAUDE.md`:

```markdown
## Frontend (`web/`, Next.js 14 static export)

- Stack pinned exactly: Next 14.2.35, React 18.3.1, `@mezo-org/passport` 0.17.2, RainbowKit 2.0.2 (Passport's pinned version; a second copy breaks it), wagmi 2.19.5 (Passport does not support wagmi 3), viem 2.57.2.
- `web/node_modules` is a symlink to `web/node_modules.nosync` so iCloud skips it; recreate it before `npm install` on a fresh clone (`mkdir node_modules.nosync && ln -s node_modules.nosync node_modules`).
- `scripts/patch-relayer.mjs` runs on postinstall/prebuild: Passport hardcodes the dead `test.mezo.org` relayer; the live one is `testnet.mezo.org`. Fails loudly if a package upgrade removes the URL.
- The wallet tree is client-only (`next/dynamic`, `ssr: false`); never import Passport, RainbowKit components, or wagmi hooks from a module that `layout.tsx`/`page.tsx` import statically.
- Bitcoin wallets act through an OrangeKit Safe: no `signTypedData` (no permits), gas paid from the Safe's BTC, relayed hash `"0x"` means failure, and a confirmed relay can hide an inner revert (`ExecutionFailure`) — `src/lib/tx/send.ts` checks both.
- After any contract change: `cd contracts && forge build`, then `npm run sync-abi` in `web/`.
- Run: `cd web && npm test && npm run build` (build includes lint and type check). `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` lives in `web/.env.local` (template `.env.example`).
```

- [ ] **Step 8: Final verification**

```bash
cd /Users/vanhuy/Desktop/mezoroute/web && npm test && npm run build
cd ../contracts && forge test
```

Expected: 67 web tests PASS, the build succeeds, and `forge test` reports 75 passed (contracts untouched).

- [ ] **Step 9: Commit, merge, and push**

```bash
cd /Users/vanhuy/Desktop/mezoroute
git branch --show-current   # feat/s1-passport-spike
git status --short           # no duplicates
git add docs/spikes PRODUCT_SPEC.md CLAUDE.md web
git commit -m "docs: record S1 Passport spike results and frontend conventions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git switch main
git merge --no-ff feat/s1-passport-spike -m "Merge branch 'feat/s1-passport-spike'

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```
