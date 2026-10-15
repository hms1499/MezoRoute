# MezoRoute — build status

Living handover file for every agent (see `AGENTS.md` → Session protocol). Update it and commit at the end of each session or milestone. Scope and the backlog are in `PRODUCT_SPEC.md` §16; this file says where we are in it.

**Last updated:** 15 Oct 2026 · **Deadline:** Wave 1 submission 26 Oct 2026 22:00. The DoD keeps one buffer day, so the target is 25 Oct. · **`main`:** clean, pushed (M1 merged).

## Where we are

| Task | State | Notes |
|---|---|---|
| C1 contracts + testnet executor | Done | Testnet executor `0xB36B2E012003840951CFf00fA6b1E3237A110920` (10 bps, cap 1,000,000 MUSD, deploy block 15,903,010) |
| S1 Passport spike | Done | `docs/spikes/s1-passport-static-export.md` |
| F1 app shell | Done | |
| F2 dashboard | Done | |
| F3 LP route | Done | |
| F4 Borrow & Deploy | Done | |
| F5 Stability Pool | Done | |
| F6 route comparison | Done (15 Oct) | Includes 30-day on-chain results and a backtest |
| F7 LP positions | Done | |
| F8 mainnet reference card + quote accuracy | Done (15 Oct) | `npm run quote-accuracy`: 14/14 testnet entries exact |
| M1 mainnet deployment | Done (15 Oct) | Executor `0x046449b1229C863e278f369869BA10e12bd80d9E`; round trips and hashes in `PRODUCT_SPEC.md` §20 |
| **U1 UI polish** | **Implemented and QA-passed (15 Oct); final branch review, then merge on the user's word** | Branch `feat/u1-ui-polish` (local, not pushed): spec `docs/superpowers/specs/2026-10-15-u1-ui-polish-design.md`, plan `docs/superpowers/plans/2026-10-15-u1-ui-polish.md` (11 tasks, all done) |
| V1 Vercel production + QA on both wallet types | Not started | The current preview sits behind a Vercel login; judges need a public URL |
| D1 README, deck, 2-minute video, submission form | Not started | Needs V1 and M1 |

Tests at `main` (15 Oct): 635 Vitest and 75 Foundry. On `feat/u1-ui-polish`: 678 Vitest; `npm run build` passes (First Load JS of `/` 92 kB).

## Next: finish U1 → V1 → D1

1. U1: final whole-branch review done (no Critical; 3 Important fixed in `a5c02bb`). **Waiting on the user:** merge `feat/u1-ui-polish` into `main` and push.
2. V1: public Vercel production URL; QA on both wallet types. Bitcoin wallets on mainnet can no longer deposit BTC natively (bridge-in closed 13 Oct).
3. D1: README, deck, video, submission form.

## M1 record (15 Oct)

**Mainnet executor:** `0x046449b1229C863e278f369869BA10e12bd80d9E`, block 12,524,142, tx `0x8aa55418f1da98ea1700c9e950f01d8cadf94fc34633650f5e60f9e68aafb71d`, fee 10 bps to `0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`, cap 1,000 MUSD. Every immutable read back from chain matches; source verified on the explorer. Round trips passed with the user's MetaMask (`0x375a…d6e8`); hashes in `PRODUCT_SPEC.md` §20. `QUOTE_NETWORK=mainnet npm run quote-accuracy`: 1/1 exact.

**Deployer exception (user's decision):** the mainnet deployer is `0xd74f…2B49`, the same key as the testnet deployer in `contracts/.env` (plaintext), imported into the keystore `mezo-mainnet`. The executor has no admin, so the key controls only that wallet's own funds (≈0.000017 BTC left). Don't keep more than gas money there.

**Funding route:** Mezo's native BTC bridge-in from Bitcoin closed on 13 Oct 2026. BTC now enters Mezo as tBTC from Ethereum through the Mezo app's Deposit (17 minutes: Ethereum finality plus a few minutes). MUSD can also come from Base or Ethereum through Wormhole NTT (Portal).

### M1b plan (kept for reference)

The user chose to have **their own MetaMask account deploy the executor and run the UI round trips**.

1. **User:** fund the MetaMask account on Mezo mainnet with about 0.0004 BTC. Swap about 0.00025 BTC for **20 MUSD** on mezo.org; keep about 0.0001 BTC for gas. Real cost is about 2–3 USD; deploy gas alone is about 0.6 USD.
2. **User, in their own terminal:** `cast wallet import mezo-mainnet --interactive` (paste the MetaMask private key, set a password). Then send the agent the **public** address.
3. **Agent:**
   - check the mainnet balances;
   - re-run the dry run: `cd contracts && FEE_BPS=10 FEE_RECIPIENT=<addr> forge script script/Deploy.s.sol --rpc-url mezo_mainnet --sender <addr>`;
   - show the parameters for confirmation: fee 10 bps, cap 1,000 MUSD (`maxMusdInFor`), fee recipient.
4. **User runs the broadcast** (it prompts for the keystore password): add `--account mezo-mainnet --broadcast` to the dry-run command. Deploying is irreversible, so confirm first.
5. **Agent:**
   - verify with `forge verify-contract … --chain 31612 --verifier blockscout --verifier-url https://api.explorer.mezo.org/api`;
   - set `networks.mainnet.executor = { address, feeBps: 10n, deployBlock }` in `web/src/lib/config/networks.ts` and update the "no mainnet executor before M1" test;
   - rebuild and QA locally.
6. **Round trips through the UI** (Wave 1 gate). Do them with the user's MetaMask:
   - Stability Pool deposit → withdraw, **first**: withdrawals pause if any Trove falls below MCR, and the lowest mainnet Trove was at 116% ICR against 110% on 15 Oct.
   - LP enter → claim fees → exit.
7. **Agent:**
   - run `QUOTE_NETWORK=mainnet npm run quote-accuracy`;
   - record addresses and tx hashes in `PRODUCT_SPEC.md` §11.1/§20 and in this file;
   - update `contracts/SELF_AUDIT.md` if needed.

Optional prep that needs no funds:
- give `contracts/script/smoke-testnet.sh` env overrides for the mainnet addresses (it hard-codes testnet);
- U1 can start on testnet screens at any time.

### M1a pre-flight results (15 Oct, read-only, all passed)

- **Mainnet deploy dry run:** the constructor's factory/pool checks pass. It costs about 2.81M gas, about 0.0000073 BTC at 0.0026 gwei.
- **EIP-712 domains on chain 31612** match what the app signs:
  - MUSD permit: "Mezo USD", "1".
  - LP permit: name `""`, "1".
  - Borrow authorisation: "BorrowerOperationsSignatures", "1".
- **System getters work:** TCR about 519%, 8 Troves, minimum net debt 1,800 MUSD (so opening a Trove for a demo is expensive; swap for MUSD instead).
- **Explorer verification:** the mainnet Blockscout API answers at `https://api.explorer.mezo.org/api`.
- **Mainnet relayer** for Bitcoin wallets (`https://mezo.org/api/v2/relay/`) answers like the live testnet one. It has not been tried with a real Unisat transaction.
- **Mainnet RPC:** `https://rpc-internal.mezo.org` (Passport's). viem's built-in `rpc.mezo.org` has no DNS record.

## Waiting on the user

- T0 research for the deck: 1–2 quotes from Mezo Discord users, and the step count for borrow → LP in the Mezo app.
- Report to the Mezo team (Discord):
  - Passport/OrangeKit hard-code the dead relayer `test.mezo.org` (patched locally by `web/scripts/patch-relayer.mjs`).
  - A testnet RPC backend returns intrinsic-only gas estimates and null receipts for mined transactions.
- Unconfirmed: spec §16 says "product code starts on 16 Oct"; we don't know whether this is a hackathon rule.

## Decisions still open / deferred minors

**F6 deferred:**
- The LP backtest treats the user as a marginal LP, so huge amounts over-credit fees.
- Retry shows no refetch feedback.
- No testnet token-order parse test.
- Cosmetics: "+<0.01 MUSD" and "≈0% a year".
- The Stability Pool "BTC exposure after" drops by the pending gain, because the gain is paid to the wallet and the exposure module ignores wallet BTC. Needs a product look.

**F8 deferred:**
- The card hard-codes "30 days".
- The accuracy script can't tell "no Sync logs" from "logs missing".
- The log scan has no retry.
- The "caller's own swap" label can mislabel app swaps.
- A reverting `fetchPrice` blanks the card.
- Retry shows no feedback.
- Load tests lack the success and hang paths.

**Older deferred items:**
- The receipt explorer link uses the original hash for a replaced transaction.
- `confirmCall` has no abort on unmount.
- A smart account on a `?mode=borrow` link stays in borrow mode (blocked).

**U1 deferred:**
- The mainnet reference card's labels ("LP fees, last 30 days", "Share of MUSD supply") wrap inside its two-column layout. This is wrapping, not overflow; the comparison card no longer wraps (it shows tabs below 640 px).
- Final-review minors (deferred):
  - The SP route page shows the current deposit and pending gain only after an amount is typed.
  - Cost-basis skeletons and comparison skeletons have no screen-reader text; a step's failure message sits outside its live region.
  - The invalid-hash receipt has no back link (at 360 px only the logo leads home).
  - The paused withdraw page hides the deposit/gain summary.
  - "BTC exposure" means total exposure (with Trove) on the dashboard but positions-only on /positions.
  - The amount input's focus indicator is a 1 px border plus a faint ring, not the 2 px ring.
  - The mobile comparison tabs lack arrow-key support.
  - The summary strip truncates values above ≈10,000,000.
  - The exit page has no quote timer (only its gate).

## QA accounts and recipes

- **Testnet read-only accounts:**
  - no Trove: `0xe37c0e20cf9f466e869a9e20ffbe66333b8f6b74`
  - can borrow: `0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56`
  - at risk: `0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa`
- **Mainnet:** `0xDc887b3D44bdf789d60D2d427d5E8dB6e4ED6aD1` (its Trove is now closed).
- **Testnet test wallets:**
  - user's MetaMask `0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`
  - user's Unisat Safe `0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D`
  - deployer `0xd74f…2B49`, about 1,840 MUSD; its key is in `contracts/.env` (testnet only)
- **Local QA:**
  - Run `cd web && npm run build`, then serve `web/out` with `python3 -m http.server <port> --bind 127.0.0.1`. Restart the server after every rebuild, because `next build` recreates `out/`.
  - Drive the app with Playwright. Use a keyless mock EIP-1193 wallet injected with `context.addInitScript`: it answers `eth_accounts`/`eth_chainId` (`0x7b7b` testnet, `0x7b7c` mainnet), forwards other calls to the RPC, announces itself through EIP-6963 as MetaMask, and sets `localStorage["mezoroute.network"]`.
  - For live signing, use a local signer process. Never put a key in a transcript.
- **Tooling quirks:**
  - Python RPC calls need a non-Python User-Agent (Cloudflare returns 403).
  - macOS has no `timeout`.
  - zsh doesn't word-split `$VAR`.
  - Vitest 5 hides console output of passing tests.

## Deck positioning (agreed)

"DeFi Saver/Summer.fi for MUSD borrowers on Mezo, plus a BTC-risk route comparison and Bitcoin-wallet support."

The readiness gaps identified on 12 Oct were mainnet (M1), a public URL (V1), and the README, deck, video, and tag (D1). The route comparison gap is now closed by F5 + F6.

## Session log

- **15 Oct 2026, late night (Claude Code):**
  - Final U1 review (fresh reviewer): ready "with fixes". Three Important findings fixed with tests, plus two minors regraded to Important (stepper contrast, landing copy).
  - The quote timer now follows the 15 s refresh.
  - Mainnet gas investigated: MetaMask ignores the app's `gas` and sets 3 × its own estimate. Details are in AGENTS.md (Gas limits).
- **15 Oct 2026, night (Claude Code):** U1 implemented inline (executing-plans), 11 tasks plus one fix, each QA-checked with Playwright and the keyless mock wallet. The full matrix passed: 9 screens × 2 networks × 4 widths with no horizontal scroll, every keyboard stop has a focus ring, and nothing animates under reduced motion. Rulings: app Connect button when disconnected, tabular figures per element, `grid-cols-1` on responsive grids, transposed drawdown table. Next: final branch review, then merge on the user's word.
- **15 Oct 2026, evening (Claude Code):** M1 merged and pushed. U1 brainstormed with `ui-ux-pro-max` research; design approved in four sections; spec and 11-task plan committed on `feat/u1-ui-polish` (not pushed). Next: user picks the execution method.
- **15 Oct 2026, afternoon (Claude Code):** user bridged tBTC from Ethereum; mainnet executor deployed by the user from the keystore, verified by the agent, pinned in the app on `feat/m1-mainnet-executor`; read-only mainnet QA passed; the user ran the Stability Pool and LP round trips through the UI; mainnet quote accuracy 1/1 exact. M1 done.
- **15 Oct 2026 (Claude Code):**
  - F6 and F8 designed, built, reviewed, merged, and pushed.
  - U1 added to the backlog.
  - M1a pre-flight passed; the user chose MetaMask for M1.
  - `AGENTS.md`, `docs/STATUS.md`, and the session protocol set up for multi-agent handover.
