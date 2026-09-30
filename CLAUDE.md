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
- Deploy/smoke secrets live in `contracts/.env` (git-ignored; template `.env.example`). Load with `set -a && source .env && set +a`; never print `PRIVATE_KEY`. `Deploy.s.sol` refuses mainnet (31612) until the per-transaction cap exists.
- The public testnet RPC intermittently returns null receipts — poll instead of failing (see `send()` in the smoke script).

## Repo conventions

- Work on a feature branch, then merge locally into `main` and push `main`. Conventional commit prefixes (`feat(contracts):`, `fix(contracts):`, `test(contracts):`, `chore:`).
- Code, comments, commits, and docs are in English.
- Git identity for this repo is set locally: `hms1499 <thanvanhuy159@gmail.com>`.
- The repo sits in an iCloud-synced Desktop, which spawns duplicate files named `* 2.*` / `* 3.*` and `* 2` directories. Before committing, check `git status` for them; delete only after confirming they are identical to the original.
