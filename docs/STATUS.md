# MezoRoute — build status

Living handover file for every agent (see `AGENTS.md` → Session protocol). Update it and commit at the end of each session or milestone. Scope and the backlog are in `PRODUCT_SPEC.md` §16; this file says where we are in it.

**Last updated:** 17 Oct 2026 · **Deadline:** Wave 1 submission 26 Oct 2026 22:00. The DoD keeps one buffer day, so the target is 25 Oct. · **`main`:** U4 merged locally (not pushed); U5 homepage polish is complete on `feat/u5-homepage-polish`, not merged.

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
| U1 UI polish | Done (15 Oct), merged and pushed | Spec `docs/superpowers/specs/2026-10-15-u1-ui-polish-design.md`, plan `docs/superpowers/plans/2026-10-15-u1-ui-polish.md` (11 tasks, all done) |
| U2 landing redesign | Done (15 Oct), merged and pushed | Spec `docs/superpowers/specs/2026-10-15-u2-landing-redesign-design.md`, plan `docs/superpowers/plans/2026-10-15-u2-landing-redesign.md` |
| U3 one identity, landing to app | Done (16 Oct), merged and pushed | Spec `docs/superpowers/specs/2026-10-16-u3-app-identity-design.md`, plan `docs/superpowers/plans/2026-10-16-u3-app-identity.md` (13 tasks); branch `feat/u3-app-identity`. Fixes the 10 findings of the 16 Oct design review |
| U4 homepage visual system refinement | Done (17 Oct), merged locally into `main`, not pushed | Spec and plan in `docs/superpowers/`; 771 Vitest pass, static build pass at 92 kB, Playwright QA pass at 360/768/1024/1440 px, reduced motion, keyboard, network switching, and keyless EVM connection. Navbar follow-up centers Dashboard/Positions in the available header space and keeps the full-width header sticky while scrolling; footer divider now spans the viewport while its content stays aligned to the page column. |
| U5 homepage polish | Done on `feat/u5-homepage-polish` (17 Oct), not merged | Small change approved in chat (no spec): hero chart no longer logs NaN before data loads (empty geometry is finite) and its value labels get a background halo; hero and final-CTA actions stack full width below 640 px; simulator uses mono for figures only (`SimCell.figure` marks numeric text); shorter simulator Connect label below 640 px; Live strip's Executor is a sans link with a badge; final CTA is a glow panel with "Read the source"; footer has brand + links (`src/lib/config/links.ts`) over a full-width disclaimer row; AppShell pads the bottom below 1024 px only when a `[data-mobile-bar]` is present (the landing had ~96 px of dead space under the footer). Follow-up: the Mainnet banner sat flush against the U4 sticky header's border (gap 0 px); it now has `mt-4` (16 px, checked on home, positions, route). 773 Vitest pass, build pass at 92 kB, Playwright at 360/768/1440 px + reduced motion, 0 console errors. |
| V1 Vercel production + QA on both wallet types | Not started | The current preview sits behind a Vercel login; judges need a public URL |
| D1 README, deck, 2-minute video, submission form | Not started | Needs V1 and M1 |

Tests at `main` (16 Oct): 766 Vitest and 75 Foundry. `npm run build` passes (First Load JS of `/` 92 kB).

## Next: V1 → D1

1. V1: public Vercel production URL; QA on both wallet types. Bitcoin wallets on mainnet can no longer deposit BTC natively (bridge-in closed 13 Oct).
2. D1: README, deck, video, submission form.

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

**U2 deferred (final review minors):**
- The simulator table reflows slightly while figures count, because trailing zeros are trimmed.
- The stacked mobile table may lose table semantics in VoiceOver.
- Hover state re-renders the whole landing.

**U3 deferred (final review minors):**
- The empty hero chart (before mainnet data loads) computes NaN tick coordinates; the browser drops them.
- The Positions chart's screen-reader label has no figures; the crossing label sits inside `role="img"` and is not read.
- `RouteLayout`'s aside is always labelled "Summary" (also on Confirm, What next, Totals), and is an empty landmark on Positions without totals.
- With two recovery buttons the 360 px mobile bar may cover part of the footer (estimated, not measured).
- "Show figures" has no open/closed marker.
- The chart's height jumps once on first measure (320 px fallback).
- The header account button's `text-ink` override depends on CSS order.
- A balance under 0.005 MUSD shows "Use my balance (0.00 MUSD)".

**Older deferred items:**
- The receipt explorer link uses the original hash for a replaced transaction.
- `confirmCall` has no abort on unmount.
- A smart account on a `?mode=borrow` link stays in borrow mode (blocked).

**U1 deferred:**
- The mainnet reference card's labels ("LP fees, last 30 days", "Share of MUSD supply") wrap inside its two-column layout. This is wrapping, not overflow; the comparison card no longer wraps (it shows tabs below 640 px).
- Final-review minors (deferred):
  - The SP route page shows the current deposit and pending gain only after an amount is typed.
  - Comparison skeletons have no screen-reader text; a step's failure message sits outside its live region.
  - The invalid-hash receipt has no back link (at 360 px only the logo leads home).
  - The paused withdraw page hides the deposit/gain summary.
  - The amount input's focus indicator is a 1 px border plus a faint ring, not the 2 px ring.
  - The mobile comparison tabs lack arrow-key support.
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

- **17 Oct 2026 (Codex):** Footer divider extended full-width to match the navbar, with footer content kept inside the 6xl page column and mobile bottom clearance preserved. Verification: `npm test` (95 files, 771 tests), `npm run build`, and Playwright at 360/768/1024/1440 px; no horizontal overflow, 1 px divider spans the viewport, header remains sticky, and mobile bottom space remains 96 px. `.DS_Store` remains untouched. Next: final U4 review/merge when requested, then V1.
- **17 Oct 2026 (Codex):** Follow-up navbar polish on `codex/homepage-visual-system`: Dashboard/Positions centered in the space between brand and wallet controls; full-width sticky header with canvas backdrop and bottom hairline. QA: `npm test` (95 files, 771 tests), `npm run build`, and Playwright at 360/768/1024/1440 px; no horizontal overflow, mobile nav remains compact, header stays at top after scrolling. The pre-existing `.DS_Store` change remains untouched. Next: final U4 review/merge when requested, then V1.
- **17 Oct 2026 (Claude Code):** Merged U4 into `main` locally (771 tests and build passed first; not pushed). Built U5 homepage polish (9 items approved in chat) on `feat/u5-homepage-polish`: 773 Vitest, build 92 kB, Playwright QA at 360/768/1440 px and reduced motion with 0 console errors. Next: user merges U5, pushes `main`, then V1.
- **17 Oct 2026 (Codex):** U4 homepage visual-system refinement implemented and independently reviewed on `codex/homepage-visual-system`. Shared motion tokens, semantic landing button roles, hero/simulator surfaces, and consistent section recipes are in place; the review's 2 px focus-ring offset finding was fixed. Verification: `npm test` (95 files, 771 tests), `npm run build` (static export, homepage 92 kB), Playwright at 360/768/1024/1440 px with no overflow, keyboard focus, reduced motion, network switching, and keyless MetaMask connection. Next: V1. The pre-existing `.DS_Store` change remains uncommitted.
- **17 Oct 2026 (Codex):** U4 homepage visual-system direction and spec approved by the user. Wrote the implementation plan on `codex/homepage-visual-system`; implementation has not started. Next: user reviews the plan and selects an execution method.
- **16 Oct 2026 (Claude Code):** U3 final review (fresh reviewer): 1 Critical and 2 Important fixed with failing-first checks (toast contrast with a palette guard test, entry-cap balance action, hero line draw), plus BTC exposure as a section; minors deferred above. After user review the empty Positions state and the invalid-link receipt went full width. `feat/u3-app-identity` merged into `main` and pushed at the user's request. Next: V1.
- **16 Oct 2026 (Claude Code):** U3 implemented inline (executing-plans), 13 tasks: one dark palette (SP lavender, orange = BTC only), the "If BTC moves" chart in the hero and every exposure section, panel/section levels, no summary strip, Compare starts filled, one column per flow, one numbered sequence per page, balance-shortfall recovery, positions labels, app-owned account button. QA: 76 page loads (4 widths × all screens × both networks) with no horizontal scroll, keyboard rings on every stop, reduced motion, dark wallet modal. Rulings in the ledger (`.superpowers/`, git-ignored) are listed in the final message. Next: final whole-branch review, then merge on the user's word, then V1.
- **16 Oct 2026 (Claude Code):** design review of landing + app (Playwright, mock wallet): 10 findings, the main one is the split identity between the dark landing and the light app. The user asked to fix all ten and delegated the design calls; U3 spec written on `feat/u3-app-identity` (dark app on the night palette, Stability Pool turns lavender so orange means BTC only, an "If BTC moves" chart in the hero and the app, one column per flow). Next: user reviews the spec, then the plan.
- **15 Oct 2026, overnight (Claude Code):** U2 final review: 2 Important and 4 regraded minors fixed with tests; `feat/u2-landing-redesign` merged into `main` and pushed at the user's request. Next: V1.
- **15 Oct 2026, overnight (Claude Code):**
  - The user found the U1 landing generic. Ten DeFi landings were researched (DeFi Saver, Liquity v2, Ethena, Pendle, Euler, Sky, Mezo…), and a direction was chosen with browser mockups: "B · route map, dark", the landing only.
  - U2 implemented inline on `feat/u2-landing-redesign` (6 tasks): live wallet-free simulator on mainnet data, dark chrome via `SurfaceContext`, CSS motion.
  - QA passed: 8 width × network combinations, reduced motion, keyboard, RPC failures, leaving the landing.
  - Next: final review, merge on the user's word, then V1.
- **15 Oct 2026, late night (Claude Code):** after a local preview at the user's request, `feat/u1-ui-polish` merged into `main` and pushed. Next: V1.
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
