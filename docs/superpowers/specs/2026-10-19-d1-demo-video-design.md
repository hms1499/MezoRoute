# D1 demo video — design

**Date:** 19 Oct 2026 · **Task:** D1 (PRODUCT_SPEC §16), the video part · **Deadline:** submission 26 Oct 2026 22:00, target 25 Oct

## Intent

A product video for the AKINDO Wave 1 submission. Judges watch it to see that MezoRoute is real, live, and complete: every feature built in Wave 1 appears on screen, working against live Mezo contracts. The user wants it to look professional and to walk through **all** the features; 2:30–3:00 is acceptable (the spec's "2 minutes" is relaxed by the user).

## Decisions made by the user

- **No voiceover.** The only text on screen is a **chip** (style "B"): a small pill, top centre, under the app header, visible for the whole scene. There are **no title cards, no intro/outro cards, and no zoom effects**; the first and last scenes also use only a chip.
- **Focus by spotlight** (style "B" of the focus mockup, `.superpowers/brainstorm/58596-1792378097/content/focus-style.html`): at each step's key moment everything except the area that matters darkens (≈ 68% black over the rest of the frame, rounded rectangle around the focus), eases in over ≈ 0.5 s, holds while the viewer reads, and eases out. The page never moves or scales for it.
- **Background music:** "New Life" by Moire (Uppbeat), file `video/music/new-life.mp3` (copied from the user's download; 2:01 long).
- **Made by an automated browser, not by hand.** The agent records the live app with Playwright; transactions are **real Mezo testnet transactions** signed silently by the project's test wallet, so **no wallet popups** appear. The user accepted this.
- **Local only.** Everything for the video lives in `video/` at the repo root, which is git-ignored (committed in `b479473`). Nothing from the video build is committed; this design document is the one exception (it is a doc, like every other spec).
- **Storyboard:** the 15 scenes below, approved in the brainstorm companion (v2), including: the Mainnet today card, the pre-send guards, slippage and quote timer, Claim BTC gain, exit presets; no mobile scene.
- **App fixes during the video work are allowed** when a storyboard screen breaks an anti-goal: the agent reports the problem, the user approves the fix in chat, it is built test-first on a branch, merged, and pushed (pushing `main` deploys production), then re-checked on production before recording. Start with a check of every storyboard screen on production in the state the video puts it in (the Stability Pool withdraw page and the Positions Stability Pool card have never been seen with a real deposit).
- **Paused Stability Pool:** if `withdrawFromSP` is paused at recording time (a Trove below the 110% MCR; the lowest testnet Trove was at 111.7% on 19 Oct), the agent may liquidate that Trove with a real testnet transaction. That reopens withdrawals and gives the test wallet a real BTC gain, so scene 13 then sends a real Claim BTC gain. Never liquidate to stage a scene when withdrawals are not paused. Without a pause, scene 13 shows the button disabled (see below).
- **Claim BTC gain:** the test wallet's Stability Pool BTC gain is 0 (no testnet liquidation since its deposit). The scene shows the button disabled and the BTC gain line; it sends the claim only if a liquidation has produced a gain by recording time. The user accepted this.

## Calls made by the agent (the user can overrule)

- **Takes:** scenes 1–7 and 11 may be re-shot one by one (they send no transactions, or only read). Scenes 8–10 and 12–14 build on each other's on-chain state (LP from 8–9 appears in 12, is claimed in 13, exited in 14), so they come from **one continuous run**; a re-shoot of any of them re-runs 8–14 together. Before each full take a reset script exits leftover LP and Stability Pool deposits from earlier takes, and the builder checks the Trove's collateral ratio and MUSD balance (each take adds ≈ 50 MUSD debt plus the 0.1% borrowing fee, which the app cannot repay). Rehearse on the local build before spending on production takes.
- **Scene 11 (mainnet):** the mock wallet does not connect on mainnet (it announces itself only while the stored network is testnet), so the shot shows the disconnected mainnet app: the "Unaudited · max 1,000 MUSD" banner, live mainnet figures, and the verified executor, never the "no Trove" card. Switching back to testnet reconnects it.

## Goals, non-goals, anti-goals

- **Goal:** one 1080p MP4, ≈ 2:54 (hard limit 3:00), every Wave 1 feature visible in the live production app, every transaction real and confirmed.
- **Non-goals:** a real Bitcoin-wallet transaction (only the connect modal shows Bitcoin wallets); the at-risk Trove warning, the no-Trove card, the paused Stability Pool state, wallet-cancel notes (they need other wallet states); CLI tools (quote accuracy, tests); a mobile scene; subtitles in other languages.
- **Anti-goals (a failure even if the file plays):**
  - any number on screen that is staged or faked (mocked RPC responses, edited balances, simulated receipts);
  - a reverted or failed transaction, an error toast, a skeleton or spinner held on screen, or a console error visible in the shot;
  - text a viewer cannot read at 1080p (app text must be at least as large as at a 1440 px wide window);
  - the private key appearing anywhere: page, logs, transcript, recording;
  - over 3:00.

## Constraints

- **Target:** production `https://mezoroute.vercel.app`, Mezo testnet (chain 31611) for every transaction; mainnet only for read-only scenes (5 reads mainnet from the testnet dashboard; 11 switches the network).
- **Test wallet:** the deployer `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49`; key in `contracts/.env` (`PRIVATE_KEY`, testnet only). On 19 Oct it holds ≈ 0.0548 BTC, ≈ 1,848.6 MUSD, 0.01835 LP, an active Trove (debt ≈ 2,069 MUSD, collateral 0.045 BTC), and a 7.5 MUSD Stability Pool deposit with 0 BTC gain. Load the key with `set -a && source contracts/.env && set +a` inside the signer process only; never print it.
- **Signing without popups:** the page gets a keyless mock EIP-1193 provider (`context.addInitScript`), as in the QA recipe in `docs/STATUS.md`: it answers `eth_accounts`/`eth_chainId` (`0x7b7b`), announces itself through EIP-6963 as MetaMask, sets `localStorage["mezoroute.network"]`, and forwards reads to the RPC. Signing and sending (`eth_signTypedData_v4`, `personal_sign`, `eth_sendTransaction`) go to a **local signer process** (for example a small Node/viem server on 127.0.0.1, or a Playwright `exposeBinding`) that holds the key. The page never sees the key.
- **App behaviour to respect** (see `AGENTS.md`): switching network reloads the page; quotes refresh every 15 s and expire after 60 s; the testnet RPC sometimes returns null receipts (the app polls; give confirmations up to 120 s); Mezo charges at least half the gas limit; Borrow & Deploy needs an EOA (the mock wallet is one). The landing's hero chart draws with a CSS animation (do not use full-page screenshots; they restart animations).
- **Tooling:** `ffmpeg`/`ffprobe` at `/opt/homebrew/bin`; Playwright browsers are cached in `~/Library/Caches/ms-playwright`; Playwright is not a frontend dependency, so install it inside `video/` (its own `package.json`, git-ignored). Do not add dependencies to `frontend/`.
- **Funds:** the run spends ≈ 100 MUSD into LP, 50 MUSD borrowed (debt rises to ≈ 2,119 MUSD; the Trove stays well above the 160% floor — check before recording), 50 MUSD into the Stability Pool, plus gas (≪ 0.01 BTC). Exits return most of it. Re-check balances before each full take.

## Storyboard (approved)

Times are cumulative; lengths are on-screen time after cutting waits. Chip text is exact (bold part in the accent colour).

| # | Time | Chip | What happens | Length |
|---|---|---|---|---|
| 1 | 0:00 | **MezoRoute** Where should your MUSD go? | Landing hero; the "If BTC moves" line draws. Slow scroll past the Live strip (mainnet data). | 10 s |
| 2 | 0:10 | **Try it** No wallet needed | Simulator: 100 → 500 → 1,000; LP vs Stability Pool rows update. | 10 s |
| 3 | 0:20 | **Connect** Bitcoin or EVM wallet, via Mezo Passport | Wallet modal: "Bitcoin" (Unisat, OKX, Xverse) and "Ethereum" groups → MetaMask (the mock). | 8 s |
| 4 | 0:28 | **Dashboard** Your Trove and balances, one block | Trove, collateral ratio vs MCR, balances, Next step card. Hover "Trove" → its definition. | 10 s |
| 5 | 0:38 | **Mainnet today** Real mainnet figures, on testnet | The "Mainnet today" card at the end of the testnet dashboard. | 6 s |
| 6 | 0:44 | **Compare routes** Same amount, two destinations | Compare card: per-amount rows, 30-day on-chain results, BTC exposure chart with the MCR crossing. | 14 s |
| 7 | 0:58 | **LP route** Checked before you sign | Type more than the wallet holds → blocked with recovery options (Borrow & Deploy, use my balance, Mezo app). Then 100 MUSD: quote, minimums, price impact, fee. Change slippage; show the quote refreshing on its timer. Review. | 18 s |
| 8 | 1:16 | **One signature** Permit instead of an approval | Sign permit → enter → stepper → receipt decoded from `Entered`. (tx 1) | 14 s |
| 9 | 1:30 | **Borrow & Deploy** Borrow → LP in one transaction | 50 MUSD: resulting collateral ratio vs the 160% floor; 2 signatures, 1 transaction; receipt. (tx 2) | 20 s |
| 10 | 1:50 | **Stability Pool** Direct to Mezo, no fee | Deposit 50 MUSD: return source, risk, exact approval → deposit → receipt. (tx 3–4) | 18 s |
| 11 | 2:08 | **Mainnet** Live, capped at 1,000 MUSD | Switch to Mainnet: "Unaudited · max 1,000 MUSD per transaction" banner, verified executor. Back to testnet. | 8 s |
| 12 | 2:16 | **Positions** Every number from on-chain events | LP value and cost basis, claimable fees, Stability Pool deposit and BTC gain, combined BTC chart. | 10 s |
| 13 | 2:26 | **Claim** LP fees and Stability Pool BTC | Claim LP fees → receipt (tx 5). Then the Stability Pool card's "Claim BTC gain" (disabled unless a gain exists; see Decisions). | 10 s |
| 14 | 2:36 | **Exit** Back to MUSD, no exit fee | Exit presets 25 / 50 / 75 / Max → 50% → permit → receipt. Then Stability Pool withdraw → receipt. (tx 6–7) | 12 s |
| 15 | 2:48 | **mezoroute.vercel.app** Built on MUSD · Mezo | Back on the landing hero; music fades out. | 6 s |

Total ≈ 2:54.

## Look

- **Chip:** the app's own palette and font: background `#0A1416` at high opacity (or the accent at ~14% over the frame), 1 px `#2DD4BF` border, fully rounded, Inter 500, bold part in `#2DD4BF` weight 600, rest `#E8F1EF`. It sits centred, just below the app header, and must not cover the header controls or the scene's key content. The approved mockup is `.superpowers/brainstorm/58596-1792378097/content/title-style-v3.html` (option B). Fade in/out ≈ 0.3 s at scene boundaries; between consecutive scenes it may cross-fade.
- **Frame:** 1920 × 1080, 30 fps, H.264 (yuv420p), AAC audio. The app laid out as at a ~1440 CSS-px-wide window and rendered sharply at 1080p (for example viewport 1440 × 810 with a device scale factor of 4/3, or an equivalent that gives native-resolution text, not an upscaled blur).
- **Spotlight:** every scene has at least one, on the element the chip talks about (for example scene 2 the simulator table, scene 7 the blocked notice and then the quote, scene 9 the resulting collateral ratio, every receipt's figures). The rectangle comes from the element's on-page box measured during recording, padded ≈ 12 px, corner radius matching the app's cards; the chip stays above the dimming so it is always readable.
- **Motion:** human-paced: visible cursor, typing at a readable speed, smooth scrolls; hold each result long enough to read. Cuts between scenes may be hard cuts or short (≤ 0.3 s) cross-fades.
- **Music:** extend "New Life" to the video length without an audible seam (crossfade a repeated middle section), fade in ≤ 1 s, fade out over the last ≈ 3 s, level so it stays "light" (around −18 to −20 LUFS integrated).

## Deliverables (all in `video/`, git-ignored)

- `video/out/mezoroute-demo.mp4`: the final video.
- `video/out/description.txt`: a short video description for the upload, with the app link, the mainnet executor, the GitHub repo, and the Uppbeat credit line (text supplied by the user; see Open items).
- The scripts that produce them, re-runnable end to end (record → cut → overlay → music → render), so a scene can be re-shot without redoing the rest.
- A take log: each transaction hash recorded during the final take, so every receipt on screen can be checked on the explorer.

## Left to the builder

- The recorder's structure (one Playwright run per scene vs one long run with timestamps), how waits are detected and cut, and how the chip is rendered (HTML → PNG overlay, or drawn by `ffmpeg`).
- Cursor rendering (Playwright does not draw the cursor in recordings; inject a visible cursor element).
- Exact amounts may change if balances or the pool require it (for example the "more than the wallet holds" amount), as long as the scene shows the same thing.
- How the quote-timer refresh in scene 7 is shown within its 18 s (for example cut to the moment it refreshes).
- Which elements get a spotlight beyond the one per scene named above, and its exact timing.

## Open items

- **Uppbeat credit line and license code:** the user receives them when downloading the track; needed for `description.txt`.
- **Where the video is published** (YouTube or another site): affects only the description file; the 16:9 frame does not change.
