# D2 Wave 2 demo video — design

**Date:** 11 Nov 2026 · **Deadline:** Wave 2 submission 13 Nov 2026, 12:30 Vietnam time (platform record) · **Predecessor:** D1 (`docs/superpowers/specs/2026-10-19-d1-demo-video-design.md`, plan `docs/superpowers/plans/2026-10-19-d1-demo-video.md`)

## Intent

A product video for the AKINDO Wave 2 submission. The Wave 1 review scored Submission Materials 6/10 and said: "Keep the demo video under 2:15, since the 178-second cut caps Materials, and show the Borrow & Deploy flow clearly in it." This video shows what Wave 2 added (Unwind, Close, Leverage; MEZO staking in the same transaction; entry from BTC; the read-only planner) plus Borrow & Deploy, working against live Mezo contracts with real transactions, in under 2:15. The Wave 1 video (YouTube `wDJtaaEwrnk`) stays the reference for Wave 1 features.

## Decisions

Proposed by the agent in chat on 11 Nov; the user asked for proposals instead of questions and acted on them (sent the faucet BTC the proposal asked for). The user approves this document before any build.

- **Length:** target 2:05–2:10, **hard limit 2:15**.
- **Same look as D1:** no voiceover; one chip per scene (top centre, under the app header, bold part in the accent), spotlight focus (≈ 68% black over everything but the element that matters, rounded rectangle, eases in ≈ 0.5 s, holds, eases out; the page never moves or scales for it); no title cards, intro/outro cards, or zoom effects.
- **Theme:** the app's **dark** theme (`localStorage["mezoroute.theme"] = "dark"`), to match the Wave 2 deck.
- **Recorded by an automated browser** (Playwright) against **production** `https://mezoroute.vercel.app` on **Mezo testnet**; mainnet only for one read-only scene. Every transaction is a real testnet transaction signed by the deployer test wallet through a keyless mock wallet whose signing runs in Node, so no wallet popups appear.
- **Scope:** Wave 2 features and Borrow & Deploy only. The Stability Pool, LP exit, and fee claims are not shown (they are in the Wave 1 video).
- **Trove preparation:** before recording, top up the deployer's Trove with test BTC (sent by the user from the faucet on 11 Nov) using `cast` against `BorrowerOperations.addColl`, so its collateral ratio sits around 250% and Borrow & Deploy, Unwind and Leverage all have visible room. This is state setup, not staging: every figure on screen is still read live.
- **Music:** a "product demo" track chosen by the user from Envato Music (licensed through the user's Envato account, so the user downloads it); the file goes in `video/music/` (any common audio format). The track's title and author go in `description.txt` as the credit, if the licence asks for one. If no file is there when rendering, the video ships without music.
- **Local only:** everything for the video lives in `video/` (git-ignored); this document and its plan are the only committed files.

## Storyboard

Times are cumulative and approximate; lengths are on-screen time after cutting waits. Chip text is exact (bold part in the accent colour).

| # | Time | Chip | What happens | Length |
|---|---|---|---|---|
| 1 | 0:00 | **MezoRoute** Pick a route. Know the BTC risk. | Landing hero (the route motif and hero figures). | 5 s |
| 2 | 0:05 | **Plan first** No wallet needed | `/route/lp/?amount=100` before connecting: the live quote, the Stability Pool comparison in the aside, "Connect to review" as the one primary. | 8 s |
| 3 | 0:13 | **Dashboard** Your Trove and positions | Connect → wallet modal (Bitcoin and Ethereum groups visible) → MetaMask (the mock) → Dashboard: stats strip, the Trove card with its collateral ratio, routes. | 8 s |
| 4 | 0:21 | **Compare** Fees, MEZO and BTC risk | `/compare/`: LP vs Stability Pool for the example amount; spotlight the MEZO row and the BTC exposure row. | 10 s |
| 5 | 0:31 | **Borrow & Deploy** Borrow → LP → staked, one transaction | Borrow & Deploy, 100 MUSD (about 100 MUSD borrowed), staking on: the collateral ratio after vs the 160% floor; Confirm: sign the borrow authorisation, sign the permit, send; receipt decoded from the event. (tx 1) | 24 s |
| 6 | 0:55 | **MEZO** Earned while staked | Positions: wallet + staked LP in one row, pending MEZO in Rewards; Claim MEZO → confirmed. (tx 2) | 10 s |
| 7 | 1:05 | **From BTC** No MUSD needed | LP route with BTC as the asset (≈ 0.002 BTC), staking on: quote, gas reserve line; Review → permit → send → receipt. (tx 3) | 12 s |
| 8 | 1:17 | **Unwind** Lower risk in one transaction | `/trove/unwind/`: a higher target CR; cost against the oracle, debt repaid, BTC sold, redemption queue now → after (spotlight); Confirm: authorisation, permit, send; receipt. (tx 4) | 20 s |
| 9 | 1:37 | **Leverage** More BTC, same Trove | `/trove/leverage/`: a lower target CR; BTC added, new debt, fee; Confirm → receipt. (tx 5) | 14 s |
| 10 | 1:51 | **Close** Repay from collateral | `/trove/close/`: the whole debt repaid from collateral, the BTC returned, no MUSD needed. Shown, **not sent** (the Trove is needed for re-takes). | 7 s |
| 11 | 1:58 | **Mainnet** Live, capped, verified | Network menu → Mainnet: the "Unaudited · max 1,000 MUSD per transaction" banner and its "Verified contract" link. | 6 s |
| 12 | 2:04 | **mezoroute.vercel.app** | Landing hero; music fades out. | 4 s |

Total ≈ 2:08.

## Goals, non-goals, anti-goals

- **Goal:** one 1080p MP4 under 2:15, every scene above in the live production app, every transaction real and confirmed, Borrow & Deploy clearly shown.
- **Non-goals:** a real Bitcoin-wallet transaction; a real Close; a mainnet transaction; the Stability Pool, exit and claim-fees flows; a mobile scene; voiceover or subtitles.
- **Anti-goals (a failure even if the file plays):**
  - any staged or faked number (mocked RPC responses, edited balances, simulated receipts);
  - a reverted or failed transaction, an error toast, a skeleton or spinner held on screen, or a console error in the shot;
  - text a viewer cannot read at 1080p;
  - the private key anywhere: page, logs, transcript, recording;
  - over 2:15.

## Constraints

- **Test wallet:** the deployer `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49`; key `PRIVATE_KEY` in `contracts/.env` (testnet only), loaded only inside the Node signer process (`set -a && source contracts/.env && set +a`), never printed. State on 11 Nov before the top-up: 0.0622 BTC, 3,060 MUSD, a Trove of 0.045 BTC / ≈ 2,002 MUSD debt (CR ≈ 164.6% at a 73,251 MUSD/BTC oracle price). Testnet Trove minimum debt is 1,800 MUSD, so Unwind's reachable CR depends on how much debt is above it.
- **Funds after the top-up:** keep at least ≈ 0.02 BTC in the wallet for gas (each Trove action ≈ 0.6–0.9M gas; Mezo charges at least half the gas limit) and the BTC entry. Re-check the Trove ratio and balances before every full take.
- **App behaviour to respect** (see `AGENTS.md`): wallet tree is client-only; switching network reloads the page; quotes refresh every 15 s and expire after 60 s; the testnet RPC sometimes returns null receipts (the app polls up to 120 s); Borrow & Deploy and the Trove actions need an EOA (the mock is one); EOAs sign permits; the Trove actions sign an `AdjustTrove`-style authorisation first. Trove pages take `?cr=` (and `?btc=` where used) and `?slippage=`; the LP route takes `?amount=`, `?mode=borrow`, `?asset=btc`, `?stake=0`.
- **Mock wallet:** start from `frontend/scripts/live/mock-wallet.ts` (accounts, chain, EIP-6963 announce, theme and network in `localStorage`); signing and sending (`eth_signTypedData_v4`, `personal_sign`, `eth_sendTransaction`) go to a Node binding that signs with viem and sends to `https://rpc.test.mezo.org`. In D1 the mock announced itself only on testnet, so scene 11 shows the disconnected mainnet app; that is acceptable here too.
- **Frame:** 1920 × 1080, 30 fps, H.264 yuv420p, AAC; the app laid out as a ~1440 CSS-px-wide window rendered at native 1080p sharpness (for example viewport 1440 × 810 at device scale factor 4/3).
- **Tooling:** `ffmpeg`/`ffprobe` at `/opt/homebrew/bin`; Playwright Chromium at `~/Library/Caches/ms-playwright/chromium-1248` (Playwright 1.56 in `frontend/node_modules` expects a newer build; pass `executablePath`). Install the video tool's own dependencies inside `video/` (its own `package.json`); never add dependencies to `frontend/`. The D1 plan's Tasks 1–4 (timeline maths, overlays, chain scripts, CDP screencast recorder) describe a tool that worked; its code was deleted on 5 Nov and is rebuilt.
- **Known flake:** the local static server reset connections once on 11 Nov and a page showed "Application error"; production is served by Vercel, but every take still checks the page for errors before keeping a scene.

## Calls made by the agent (the user can overrule)

- **App fixes during the video work** follow D1's rule: if a storyboard screen breaks an anti-goal, the agent reports it, the user approves the fix in chat, it is built test-first on a branch, merged and pushed (a push to `main` deploys production), and the screen is re-checked on production before recording. Start with a walkthrough of every storyboard screen on production in the state the video puts it in.
- **A Trove scene that cannot send:** after the top-up, Unwind has the debt above the 1,800 MUSD minimum to work with (about 300 MUSD after Borrow & Deploy), which is enough for a visible ratio change. Leverage on testnet can be stopped by the oracle bound (the pool has sat several percent from Mezo's oracle; the bound is 5% by default and 10% at most). If at recording time Leverage cannot send within the bound the app allows, scene 9 shows the page unsent, like Close, with the app's own message naming the limit; no chain manipulation beyond the Trove top-up is done to force it.
- **MEZO to claim:** the testnet gauge pays (≈ 1.24 MEZO/s across all staked LP, period running on 11 Nov), but a few seconds of staking earns very little; scene 6 is recorded after a wait long enough for the pending MEZO to read as a visible amount, or uses MEZO already pending on the wallet's staked LP.
- **Errors in a take:** a take fails on an uncaught page error, an error toast, or an error state on screen. `console.error` lines from third-party libraries (WalletConnect, Passport, RainbowKit) are logged for review but fail a take only when the app shows something wrong.
- **Review and hand-off:** the user reviews one draft cut (target: evening of 12 Nov, Vietnam time) before the final render; the user uploads the final file to YouTube; the agent then updates the README's video link and `docs/STATUS.md` and commits them.

## Takes

Scenes 1–4, 10 and 11 send nothing and can be re-shot one at a time. Scenes 5–9 change chain state in order (the LP from 5 is what 6 claims from; 8 and 9 move the Trove that 5 borrowed against), so they come from one continuous run; a re-shoot of any of them re-runs 5–9 after re-checking the Trove and balances.

## Deliverables (in `video/`, git-ignored)

- `video/out/mezoroute-wave2-demo.mp4`: the final video.
- `video/out/take-log.jsonl`: every transaction hash of the final take, so each receipt on screen can be checked on the explorer.
- `video/out/description.txt`: upload description with the app link, the mainnet contracts (executor V2 and `MezoRouteLeverage`), the GitHub repo, and the music credit.
- The scripts, re-runnable end to end (record → cut → overlay → music → render).

## Left to the builder

- Recorder structure, wait detection and cutting, chip/spotlight rendering, cursor drawing (as in D1).
- Exact amounts and target ratios, as long as each scene shows the same thing and the Trove stays above the 160% floor after Borrow & Deploy and Leverage.
- Which elements get a spotlight beyond the one each scene names, and its timing.
- Whether a scene's length moves by a few seconds, as long as the total stays under 2:15.
