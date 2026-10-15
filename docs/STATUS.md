# MezoRoute — build status

Living handover file for every agent (see `AGENTS.md` → Session protocol). Update it and commit at the end of each session or milestone. Scope and the backlog are in `PRODUCT_SPEC.md` §16; this file says where we are in it.

**Last updated:** 15 Oct 2026 · **Deadline:** Wave 1 submission 26 Oct 2026 22:00. The DoD keeps one buffer day, so the target is 25 Oct. · **`main`:** clean, pushed.

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
| **M1 mainnet deployment** | **In progress: pre-flight done, deploy waits on the user** | See "Next" |
| U1 UI polish | Not started | Added 15 Oct; after M1, before V1 |
| V1 Vercel production + QA on both wallet types | Not started | The current preview sits behind a Vercel login; judges need a public URL |
| D1 README, deck, 2-minute video, submission form | Not started | Needs V1 and M1 |

Tests at `main` (15 Oct): 634 Vitest and 75 Foundry. `npm run build` passes.

## Next: M1b (mainnet deploy and round trips)

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

- Mainnet wallet funding and keystore import (M1b steps 1–2).
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

**For U1:**
- At 360 px, short labels wrap (reference card, comparison card).

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

- **15 Oct 2026 (Claude Code):**
  - F6 and F8 designed, built, reviewed, merged, and pushed.
  - U1 added to the backlog.
  - M1a pre-flight passed; the user chose MetaMask for M1.
  - `AGENTS.md`, `docs/STATUS.md`, and the session protocol set up for multi-agent handover.
