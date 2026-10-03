# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MezoRoute — hackathon project for "Build with MUSD and MEZO" (AKINDO WaveHack, Wave 1 deadline 26 Oct 2026 22:00). `PRODUCT_SPEC.md` is the binding authority for scope, addresses, invariants, and the task backlog (Section 16); plans live in `docs/superpowers/plans/`. When code and spec disagree, follow the spec or update it explicitly — never drift silently.

## Contracts (`contracts/`, Foundry)

- Toolchain is pinned to match Mezo: Solidity 0.8.24, `evm_version = london` (Mezo supports London only), `via_ir = true`, **OpenZeppelin 4.9.0** (import paths like `security/ReentrancyGuard.sol`, not OZ 5), Tigris at commit `0a3b5e8` via `@tigris/` remapping.
- **No fork tests.** Mezo's BTC token (`0x7b7C…`) is a chain precompile; on an anvil fork even `balanceOf` reverts. Tests deploy the real Tigris Pool/PoolFactory/Router locally with mock MUSD/BTC (`test/harness/TigrisHarness.sol`). Real-chain behaviour is checked with `script/smoke-testnet.sh` against Mezo testnet.
- `forge script` also simulates locally, so any script that touches BTC fails; use `cast` for live interactions (see the smoke script).
- In tests, build params with `_enterParams`/`_exitParams` **before** `vm.prank` — they make external calls that would consume the prank.
- Run: `cd contracts && forge test`; format with `forge fmt` (`forge fmt --check` must pass before commit).
- Security invariants from spec 11.8 must hold: every payout is a balance delta measured inside the call (pre-existing executor balances are never paid out), exact allowances reset to 0, no owner/admin/proxy, borrowed MUSD recipient is always the caller, recipient may not be the executor or the pool.
- Deploy/smoke secrets live in `contracts/.env` (git-ignored; template `.env.example`). Load with `set -a && source .env && set +a`; never print `PRIVATE_KEY`. `Deploy.s.sol` pins the entry cap per chain (`maxMusdInFor`: mainnet 1,000 MUSD, testnet 1,000,000 MUSD).
- `contracts/SELF_AUDIT.md` maps every spec 11.8 invariant to tests; update it with any change to `src/`.
- The public testnet RPC intermittently returns null receipts — poll instead of failing (see `send()` in the smoke script).

## Frontend (`web/`, Next.js 14 static export)

- Stack pinned exactly: Next 14.2.35, React 18.3.1, `@mezo-org/passport` 0.17.2, RainbowKit 2.0.2 (Passport's pinned version; a second copy breaks it), wagmi 2.19.5 (Passport does not support wagmi 3), viem 2.57.2.
- iCloud: after a fresh `npm install`, run `xattr -w 'com.apple.fileprovider.ignore#P' 1 web/node_modules` so iCloud skips it (npm 11 replaces a `node_modules.nosync` symlink with a real directory).
- `scripts/patch-relayer.mjs` runs on postinstall/prebuild: Passport hardcodes the dead `test.mezo.org` relayer; the live one is `testnet.mezo.org`. Fails loudly if a package upgrade removes the URL.
- The wallet tree is client-only (`next/dynamic`, `ssr: false`); never import Passport, RainbowKit components, or wagmi hooks from a module that `layout.tsx`/`page.tsx` import statically. `next.config.mjs` aliases optional `@x402/*` and React Native storage to `false` and transpiles `@mezo-org/orangekit-contracts` (raw TypeScript) — see the comments there before touching it.
- Bitcoin wallets act through an OrangeKit Safe: no `signTypedData` (no permits), gas paid from the Safe's BTC, relayed hash `"0x"` means failure, and a confirmed relay can hide an inner revert (`ExecutionFailure`) — `src/lib/tx/send.ts` checks both.
- After any contract change: `cd contracts && forge build`, then `npm run sync-abi` in `web/`.
- Run: `cd web && npm test && npm run build` (build includes lint and type check). Don't run `next build` while `next dev` is running — they share `.next`. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` lives in `web/.env.local` (template `.env.example`).
- Vercel project `mezoroute` (root `web/`, `vercel.json` sets the Next.js framework). Preview: `cd web && vercel deploy --yes --build-env NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=…`. If `vercel link` appends `.env*` to `.gitignore`, revert it (it would ignore `.env.example`).
- S1 spike results and live tx hashes: `docs/spikes/s1-passport-static-export.md`. `src/app/_spike/` is throwaway UI that F1 replaces.

## Repo conventions

- Work on a feature branch, then merge locally into `main` and push `main`. Conventional commit prefixes (`feat(contracts):`, `fix(contracts):`, `test(contracts):`, `feat(web):`, `fix(web):`, `chore:`).
- Code, comments, commits, and docs are in English.
- Git identity for this repo is set locally: `hms1499 <thanvanhuy159@gmail.com>`.
- The repo sits in an iCloud-synced Desktop, which spawns duplicate files named `* 2.*` / `* 3.*` and `* 2` directories. Before committing, check `git status` for them; delete only after confirming they are identical to the original.
