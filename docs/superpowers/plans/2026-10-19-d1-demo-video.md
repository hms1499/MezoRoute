# D1 Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `video/out/mezoroute-demo.mp4`: a ≈ 2:54 (≤ 3:00) 1080p product video of the live app, 15 scenes with a chip per scene, spotlight focus, real testnet transactions, and "New Life" as background music.

**Architecture:** A local Node tool in `video/` (git-ignored, its own `package.json`). Playwright drives Chromium with a keyless mock EIP-1193 wallet whose signing runs in Node; a CDP screencast recorder saves high-quality timestamped frames plus an event log (scene boundaries, waits to cut, spotlight boxes, transaction hashes). A render script turns frames + events into the final MP4 with `ffmpeg`: cut waits, overlay chip and spotlight PNGs with alpha fades, concatenate, add the extended music.

**Tech Stack:** Node 24 (ESM `.mjs`, `node:test`), Playwright (Chromium), viem 2.57.2, ffmpeg/ffprobe (`/opt/homebrew/bin`), `cast` for spot checks.

**Spec:** `docs/superpowers/specs/2026-10-19-d1-demo-video-design.md` (read it first; the storyboard table there is the script).

## Global Constraints

- Everything lives in `video/` (git-ignored, `b479473`). Never add files or dependencies to `frontend/` or `contracts/` for the video. Only this plan and `docs/STATUS.md` get committed.
- Output: 1920 × 1080, 30 fps, H.264 `yuv420p`, AAC; total length ≤ 180.0 s, target ≈ 174 s.
- App layout as at a 1440 × 810 CSS-px window, rendered at native 1080p (device scale factor 4/3); no upscaled blur.
- Chip: top centre under the app header, whole scene; background `#0A1416` ≈ 88% opacity, 1 px `#2DD4BF` border, fully rounded, Inter 500 `#E8F1EF`, bold part Inter 600 `#2DD4BF`; fade 0.3 s. Exact chip texts are in the spec's storyboard.
- Spotlight: rest of frame ≈ 68% black, rounded rectangle around the element padded 12 px (CSS px), corner radius 16 px (CSS px), ease in 0.5 s, hold, ease out 0.5 s; never move or scale the page. Chip always drawn above the dimming. At least one spotlight per scene.
- No title cards, no zoom, no voiceover, no wallet popups.
- Transactions: Mezo testnet only (chain `31611`, `0x7b7b`, RPC `https://rpc.test.mezo.org`); production URL `https://mezoroute.vercel.app`; test wallet `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49`, key from `contracts/.env` read only inside Node; never print, log, write, or pass the key to the page.
- Anti-goals (fail the take): staged numbers, a reverted transaction, an error toast, a spinner/skeleton held on screen, a visible console error, unreadable text, over 3:00.
- App fixes: if a storyboard screen breaks an anti-goal, stop, report to the user, and fix only after approval in chat (test-first branch, merge, push `main` = production deploy), then re-check production.
- Liquidation: only when `withdrawFromSP` is actually paused at recording time (a Trove below 110% MCR); never to stage a scene.
- Music: `video/music/new-life.mp3` (121.26 s), extended without an audible seam, fade in ≤ 1 s, fade out over the last 3 s, ≈ −19 LUFS integrated.

## Review Focus

- **Testnet RPC misses a mined transaction (null receipt) or confirms slowly:** the recorder waits up to 120 s for the app's receipt page and the wait is cut; the take never fails just because a confirmation was slow (Task 4 `waitCut` timeout test).
- **A quote expires (60 s) or refreshes mid-scene:** scenes send within the quote's life; if the app shows an expired quote, the scene re-reviews instead of sending a stale one (Task 6 scene helper asserts the Review button is enabled before clicking).
- **BTC price falls between takes so Borrow & Deploy would breach the 160% floor:** preflight computes the collateral ratio after the 50 MUSD borrow and refuses below 165% (Task 3 test).
- **Stability Pool withdrawals paused at take time:** preflight detects it (simulated `withdrawFromSP`) and blocks the take; the liquidation script refuses unless a Trove is below 110% (Task 3 tests).
- **Overlay misplaced (page scrolled after measuring, box partly off screen):** spotlight boxes are measured immediately before the spotlight starts, scrolling is forbidden during a spotlight, and rectangles are clamped to the frame (Task 2 test).

---

### Task 1: Scaffold `video/`, timeline and music maths

**Files:**
- Create: `video/package.json`, `video/lib/timeline.mjs`, `video/lib/music.mjs`
- Test: `video/test/timeline.test.mjs`, `video/test/music.test.mjs`

**Interfaces:**
- Produces:
  - `SCENES: Array<{ id: number, chip: { bold: string, rest: string }, targetSec: number }>` in `timeline.mjs`, the 15 rows of the spec storyboard, exact texts and lengths.
  - `keptSegments(sceneStart: number, sceneEnd: number, cuts: Array<[number, number]>, edge = 0.4): Array<[number, number]>`: the parts of a scene to keep after removing each cut range except `edge` seconds at both ends of the cut.
  - `outputTimeline(scenes: Array<{ id, segments: Array<[number, number]> }>): Array<{ id, outStart: number, outEnd: number }>` and `mapTime(t: number, segments, outStart): number | null` (raw → output time; `null` if `t` falls in a cut).
  - `musicPlan(trackSec: number, videoSec: number, splitAt = 30, xfade = 3): { part1End: number, part2Start: number, xfade: number, fadeOutStart: number }`.

- [ ] **Step 1: Create `video/package.json`** with `"type": "module"`, `"private": true`, scripts `test: node --test test/`, and dependencies `playwright` (a version whose Chromium is already in `~/Library/Caches/ms-playwright`, else run `npx playwright install chromium`) and `viem` `2.57.2`. Run `cd video && npm install`, then `xattr -w 'com.apple.fileprovider.ignore#P' 1 node_modules` (iCloud). Check `git status` shows nothing from `video/`.

- [ ] **Step 2: Write the failing tests**

```js
// timeline.test.mjs
test("storyboard has 15 scenes totalling 174 s", () => {
  assert.equal(SCENES.length, 15);
  assert.equal(SCENES.reduce((s, x) => s + x.targetSec, 0), 174);
  assert.deepEqual(SCENES[0].chip, { bold: "MezoRoute", rest: "Where should your MUSD go?" });
  assert.deepEqual(SCENES[14].chip, { bold: "mezoroute.vercel.app", rest: "Built on MUSD · Mezo" });
});
test("keptSegments removes a cut but keeps 0.4 s edges", () => {
  assert.deepEqual(keptSegments(10, 40, [[20, 30]]), [[10, 20.4], [29.6, 40]]);
});
test("keptSegments drops a cut shorter than both edges", () => {
  assert.deepEqual(keptSegments(0, 10, [[4, 4.6]]), [[0, 10]]);
});
test("outputTimeline is contiguous and mapTime skips cuts", () => {
  const out = outputTimeline([{ id: 1, segments: [[0, 5]] }, { id: 2, segments: [[10, 12], [20, 23]] }]);
  assert.deepEqual(out.map((s) => [s.outStart, s.outEnd]), [[0, 5], [5, 10]]);
  assert.equal(mapTime(21, [[10, 12], [20, 23]], 5), 8);
  assert.equal(mapTime(15, [[10, 12], [20, 23]], 5), null);
});
// music.test.mjs
test("musicPlan extends a 121.26 s track to 174 s", () => {
  const p = musicPlan(121.26, 174);
  // part1 [0, part1End] + part2 [part2Start, end] crossfaded over 3 s
  assert.ok(Math.abs(p.part1End + (121.26 - p.part2Start) - p.xfade - 174) < 0.01);
  assert.equal(p.part2Start, 30);
  assert.equal(p.fadeOutStart, 171);
});
test("musicPlan does not extend when the track is long enough", () => {
  assert.deepEqual(musicPlan(200, 174), { part1End: 174, part2Start: null, xfade: 0, fadeOutStart: 171 });
});
```

- [ ] **Step 3: Run** `cd video && npm test` → FAIL (modules missing).

- [ ] **Step 4: Implement** `timeline.mjs` and `music.mjs` to the interfaces above (pure functions, no I/O).

- [ ] **Step 5: Run** `npm test` → all PASS.

No commit (git-ignored).

---

### Task 2: Overlays: chip and spotlight PNGs and the ffmpeg overlay graph

**Files:**
- Create: `video/lib/overlays.mjs`, `video/render/overlay-png.mjs`
- Test: `video/test/overlays.test.mjs`

**Interfaces:**
- Consumes: `SCENES` (Task 1).
- Produces:
  - `SCALE = 4 / 3` (CSS px → output px).
  - `spotRect(box: { x, y, width, height }, pad = 12, frame = { w: 1920, h: 1080 }): { x, y, w, h, r }` in output px, padded, scaled by `SCALE`, clamped inside the frame, `r = 16 * SCALE`.
  - `chipHtml(chip: { bold, rest }): string` (full HTML document, transparent background, 1920 × 1080 canvas, chip centred horizontally with its top edge at 100 output px, just below the app header (68 CSS px × 4/3 ≈ 91 output px).
  - `spotHtml(rect): string` (full-frame `rgba(0,0,0,0.68)` with a transparent rounded hole: one element with `box-shadow: 0 0 0 4000px rgba(0,0,0,.68)`).
  - `overlayFilter(inputs: Array<{ png: string, start: number, end: number, fade: number }>): string`: an ffmpeg `-filter_complex` string that loops each PNG over `[start, end]` with `fade=t=in:st=start:d=fade:alpha=1` and `fade=t=out:st=end-fade:d=fade:alpha=1`, overlaid in order onto `[0:v]`, final label `[v]`. Spotlights come before the chip in the order, so the chip is on top.
  - `renderPng(html: string, outPath: string): Promise<void>` in `render/overlay-png.mjs` (Playwright, viewport 1920 × 1080, `omitBackground: true`).

- [ ] **Step 1: Write the failing tests**

```js
test("spotRect pads, scales by 4/3 and clamps", () => {
  assert.deepEqual(spotRect({ x: 100, y: 100, width: 300, height: 150 }), { x: 117.33, y: 117.33, w: 432, h: 232, r: 21.33 });
  const edge = spotRect({ x: 1400, y: -20, width: 100, height: 100 });
  assert.ok(edge.x + edge.w <= 1920 && edge.y >= 0);
});
test("chipHtml carries the exact text and palette", () => {
  const html = chipHtml({ bold: "Try it", rest: "No wallet needed" });
  for (const s of ["Try it", "No wallet needed", "#2DD4BF", "#E8F1EF", "Inter"]) assert.ok(html.includes(s));
});
test("overlayFilter fades each overlay and keeps the chip last", () => {
  const f = overlayFilter([{ png: "s.png", start: 2, end: 6, fade: 0.5 }, { png: "c.png", start: 0, end: 10, fade: 0.3 }]);
  assert.match(f, /fade=t=in:st=2:d=0.5:alpha=1/);
  assert.match(f, /fade=t=out:st=5.5:d=0.5:alpha=1/);
  assert.match(f, /\[v\]$/);
});
```

(Round rect values to 2 decimals in `spotRect`.)

- [ ] **Step 2: Run** `npm test` → the three new tests FAIL.
- [ ] **Step 3: Implement** `overlays.mjs` and `overlay-png.mjs`. Load Inter in the HTML from Google Fonts (`@import`), and wait for `document.fonts.ready` before the screenshot.
- [ ] **Step 4: Run** `npm test` → PASS. Then render one chip and one spotlight PNG over `.superpowers/brainstorm/58596-1792378097/content/landing.jpg` with `ffmpeg -i landing.jpg -i spot.png -i chip.png -filter_complex "[0][1]overlay[a];[a][2]overlay" check.png`, open `check.png`, and compare with option B of `title-style-v3.html` and `focus-style.html`: same look, chip readable, not covering the header.

---

### Task 3: Chain scripts: mock wallet, preflight, reset, guarded liquidation

**Files:**
- Create: `video/lib/env.mjs`, `video/lib/chain.mjs`, `video/wallet/mock-wallet.mjs`, `video/scripts/preflight.mjs`, `video/scripts/reset.mjs`, `video/scripts/liquidate-if-paused.mjs`
- Test: `video/test/chain.test.mjs`

**Interfaces:**
- Produces:
  - `loadAccount(): PrivateKeyAccount` in `env.mjs`: parses `PRIVATE_KEY` from `../contracts/.env` without exporting it to `process.env` or logging it; throws if the derived address is not `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49`.
  - `ADDR` in `chain.mjs`: testnet MUSD, pool, executor `0xB36B2E012003840951CFf00fA6b1E3237A110920`, TroveManager, BorrowerOperations, SortedTroves, StabilityPool, PriceFeed (copy from `frontend/src/lib/config/networks.ts`).
  - `crAfterBorrow(collBtc: bigint, debt: bigint, borrow: bigint, price: bigint, feeBps = 10n): bigint` (1e18 = 100%; debt grows by `borrow + borrow × feeBps / 10_000`).
  - `readState(client, account): Promise<{ btc, musd, lp, debt, coll, price, spDeposit, spGain, lowestIcr, spPaused }>`; `spPaused` is a simulated `withdrawFromSP(1)` from the account reverting.
  - `preflightProblems(state): string[]`: empty when a take may start. Problems: CR after a 50 MUSD borrow < 165%; MUSD < 200; BTC < 0.005; `spPaused`.
  - `installMockWallet(context, page, account, { network: "testnet" | "mainnet" }): Promise<void>` in `mock-wallet.mjs`: the F3 QA recipe (`docs/superpowers/plans/2026-10-05-f3-lp-route.md`, around line 3270): `exposeFunction` for `eth_signTypedData_v4` and `eth_sendTransaction` (pass `gas` through when the app sets it), `addInitScript` provider announcing MetaMask via EIP-6963 and setting `localStorage["mezoroute.network"]`. The provider announces itself **only when** `localStorage["mezoroute.network"]` is `"testnet"`, so mainnet stays disconnected (spec, Calls). Every sent hash is appended to `video/out/take-log.jsonl` with the scene id.
  - CLI: `node scripts/preflight.mjs` prints the state (no key) and exits 1 with the problems; `node scripts/reset.mjs` exits all LP through the executor (approve exact, minimums 0, deadline +600 s, allowance back to 0), withdraws the whole Stability Pool deposit, and repays debt down to the value in `video/baseline.json` (written on the first run: `{ debt }`) with `BorrowerOperations.repayMUSD(amount, 0x0, 0x0)`; `node scripts/liquidate-if-paused.mjs` calls `TroveManager.liquidate(lowest)` only if `lowestIcr < 1.1e18` **and** `spPaused`, otherwise prints why it refused and exits 0.

- [ ] **Step 1: Write the failing tests**

```js
test("crAfterBorrow matches the 19 Oct state", () => {
  // 0.045 BTC at 82,539.45948 MUSD, debt 2,069.2133 MUSD, +50 MUSD borrow and 0.1% fee
  const cr = crAfterBorrow(45_000_000_000_000_000n, 2_069_213_258_431_035_735_007n, 50n * 10n ** 18n, 82_539_459_480_000_000_000_000n);
  assert.ok(cr > 1_750_000_000_000_000_000n && cr < 1_760_000_000_000_000_000n);
});
test("preflight blocks a paused Stability Pool and a low ratio", () => {
  const ok = { btc: 10n ** 16n, musd: 1000n * 10n ** 18n, coll: 45n * 10n ** 15n, debt: 2069n * 10n ** 18n, price: 82539n * 10n ** 18n, spPaused: false };
  assert.deepEqual(preflightProblems(ok), []);
  assert.match(preflightProblems({ ...ok, spPaused: true }).join(), /paused/);
  assert.match(preflightProblems({ ...ok, price: 70000n * 10n ** 18n }).join(), /165%/);
});
test("loadAccount never puts the key in process.env", () => {
  loadAccount();
  assert.equal(process.env.PRIVATE_KEY, undefined);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** the modules and the three CLIs.
- [ ] **Step 4: Run** `npm test` → PASS. Run `node scripts/preflight.mjs` → prints balances close to the spec's 19 Oct figures and exits 0 (or lists real problems). Run `node scripts/liquidate-if-paused.mjs` → refuses (lowest ICR ≈ 111.7% on 19 Oct). Do **not** run `reset.mjs` yet.
- [ ] **Step 5:** `grep -r "PRIVATE_KEY\|0x[0-9a-fA-F]\{64\}" video --include=*.jsonl --include=*.json --include=*.log` → no key material.

---

### Task 4: Recorder: CDP screencast, cursor, scene DSL, sharpness check

**Files:**
- Create: `video/record/recorder.mjs`, `video/record/cursor.mjs`, `video/record/dsl.mjs`, `video/record/assemble.mjs`, `video/record/sharpness-check.mjs`
- Test: `video/test/dsl.test.mjs`

**Interfaces:**
- Consumes: `installMockWallet` (Task 3), `SCENES` (Task 1).
- Produces:
  - `startRecording(page, dir): Promise<{ t0: number, stop(): Promise<{ frames: Array<{ file: string, t: number }> }> }>`: CDP `Page.startScreencast({ format: "jpeg", quality: 95, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 })`, each frame written as `dir/frames/NNNNNN.jpg` with its `metadata.timestamp` (seconds), acknowledged with `Page.screencastFrameAck`. Playwright's `recordVideo` is not used (fixed low bitrate).
  - `assemble(frames, outMp4, fps = 30): Promise<void>`: ffmpeg concat demuxer with per-frame `duration` (next timestamp − this one; last frame 1/fps), `-vf fps=30,format=yuv420p`, `-c:v libx264 -crf 14 -preset slow`.
  - `installCursor(context)`: `addInitScript` drawing a 22 px arrow cursor (white fill, `#0A1416` outline, `pointer-events: none`, `z-index: 2147483647`) that follows `mousemove`, with a brief ring on `mousedown`.
  - DSL in `dsl.mjs`, all appending to an events array written to `dir/events.json` (times in seconds, same clock as frame timestamps: use `performance.timeOrigin + performance.now()` in the page via `page.evaluate`, or a measured offset to `Date.now()`; the test pins the offset logic):
    - `scene(id, fn)`: logs `{ type: "scene", id, start, end }` around `fn()`.
    - `spot(page, locator, holdSec)`: `scrollIntoViewIfNeeded`, waits 300 ms, measures `boundingBox()`, logs `{ type: "spot", box, start, end: start + 0.5 + holdSec + 0.5 }`, waits that long, and throws if the page's `scrollY` changed meanwhile.
    - `waitCut(fn, timeoutSec = 120)`: logs `{ type: "cut", start, end }` around a wait (`fn` resolves when the app shows its next state); throws after `timeoutSec`.
    - `human`: `move(page, locator)` (mouse moves in 25 steps to the element centre), `click(page, locator)`, `type(page, locator, text)` (80 ms per key), `scroll(page, dy)` (smooth, 600 ms).
  - `node record/sharpness-check.mjs`: records the production landing for 5 s at viewport 1440 × 810, `deviceScaleFactor: 4/3`, assembles it, and extracts `video/out/sharpness.png` at 3 s.

- [ ] **Step 1: Write the failing tests** for the pure parts of `dsl.mjs`: event shapes, `spot` end = start + hold + 1.0, and `waitCut` rejecting after its timeout with a fake clock.

```js
test("spot logs its box and full duration", async () => {
  const ev = []; const fakePage = makeFakePage({ box: { x: 1, y: 2, width: 3, height: 4 }, scrollY: 0 });
  await spot(fakePage, "#sim", 2, { events: ev, now: fakeNow(), sleep: noSleep });
  assert.deepEqual(ev[0].box, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(ev[0].end - ev[0].start, 3);
});
test("spot throws if the page scrolls during the spotlight", async () => {
  await assert.rejects(spot(makeFakePage({ box: {}, scrollY: [0, 40] }), "#x", 1, { events: [], now: fakeNow(), sleep: noSleep }), /scroll/);
});
test("waitCut rejects after the timeout", async () => {
  await assert.rejects(waitCut(() => new Promise(() => {}), 0.01, { events: [] }), /timeout/i);
});
```

(Inject `now`, `sleep`, `events` as options so the tests need no browser; `makeFakePage`, `fakeNow`, `noSleep` are small helpers in the test file.)

- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** the recorder, cursor, DSL, assembler and the sharpness check.
- [ ] **Step 4: Run** `npm test` → PASS. Run `node record/sharpness-check.mjs`, open `video/out/sharpness.png`: 1920 × 1080 (`ffprobe`), the hero text and the simulator's mono figures crisp at 100% zoom, the cursor visible. If the frames come out at 1440 × 810 or blurred, switch to viewport 1920 × 1080 with the page zoomed to 4/3 (CDP `Emulation.setPageScaleFactor` or CSS `zoom` on `html`), re-run, and note which method works in `video/NOTES.md`.

---

### Task 5: Production walkthrough of every storyboard screen

**Files:**
- Create: `video/record/walkthrough.mjs`

**Interfaces:**
- Consumes: `installMockWallet`, `installCursor` (Tasks 3–4).

- [ ] **Step 1: Write `walkthrough.mjs`**: no recording, no transactions. With the mock wallet on production at 1440 × 810 (DSF 4/3), visit and screenshot (viewport, not full page) every screen the storyboard shows, in the state it shows it: landing (top and Live strip), wallet modal, dashboard (Trove card, Next step, a Term popover, Mainnet today card, Compare routes, BTC chart), `/route/lp/?amount=5000` (shortfall recovery), `/route/lp/?amount=100` (quote, slippage control, timer), `/route/lp/confirm/…`, `/route/lp/?amount=50&mode=borrow`, `/route/stability-pool/?amount=50` and its confirm page, mainnet dashboard (banner), `/positions/` (LP, fees, SP card with the existing 7.5 MUSD deposit), `/positions/lp/exit/?percent=50`, `/positions/stability-pool/withdraw/?percent=100`. Save to `video/out/walkthrough/NN-name.png`; collect console errors per page.
- [ ] **Step 2: Run** `node record/walkthrough.mjs` → one PNG per screen and a console-error summary.
- [ ] **Step 3: Review each PNG against the anti-goals** (staged-looking or wrong numbers, error notices, stuck skeletons, unreadable text, overflow) and against the spec scene descriptions (e.g. the shortfall offers three ways out; the exit page shows 25/50/75/Max; the Claim BTC gain button is present and disabled with gain 0).
- [ ] **Step 4: If anything fails, stop and report to the user** with the screenshots, the problem, and a proposed fix. Fix only after approval in chat, through the repo's normal process (branch, failing test first, `npm test && npm run build`, merge, push `main`), wait for the Vercel production build to be Ready, and re-run the walkthrough. If nothing fails, record "walkthrough clean" in `video/NOTES.md`.

---

### Task 6: Scene scripts

**Files:**
- Create: `video/record/scenes/01-landing.mjs` … `video/record/scenes/15-outro.mjs` (one file per storyboard scene), `video/record/run.mjs`

**Interfaces:**
- Consumes: the DSL and recorder (Task 4), `installMockWallet` (Task 3), `SCENES` (Task 1).
- Produces:
  - Each scene module: `export default async function (page, dsl): Promise<void>` performing exactly the spec row's actions with `human.*`, at least one `dsl.spot(...)` on the element the chip names (spec Look → Spotlight), and every confirmation wait wrapped in `dsl.waitCut(...)`.
  - `node record/run.mjs --group read|tx --base <url>`: `read` = scenes 1–7, 11 and 15 (each recorded in its own take dir `video/takes/<ts>-sNN/`), `tx` = scenes 8, 9, 10, 12, 13, 14 in **one** continuous take dir. Default base `https://mezoroute.vercel.app`; `--base http://127.0.0.1:4173` for the local build. Before a `tx` take, `run.mjs` runs the preflight and refuses on problems.
  - Scene rules: click **Review**/**Send** only after asserting the button is enabled (a stale or expired quote re-reviews first); scene 7 types an amount above the wallet balance (e.g. `5000`), spotlights the recovery notice, then clears it and types `100`; scene 9 uses `mode=borrow` with `50`; scene 10 deposits `50`; scene 13 claims LP fees, then spotlights the Stability Pool card's Claim BTC gain button (clicks it only if `readState().spGain > 0`); scene 14 shows the four exit presets before choosing 50%, then withdraws the Stability Pool deposit with Max; scene 11 switches to Mainnet (page reloads; wallet not announced), spotlights the banner, switches back.

- [ ] **Step 1: Write the scene modules and `run.mjs`.**
- [ ] **Step 2: Rehearse the read group on the local build:** `cd frontend && npm run build`, serve `frontend/out` with `python3 -m http.server 4173 --bind 127.0.0.1`, then `node record/run.mjs --group read --base http://127.0.0.1:4173`. Expected: 9 take dirs, each with frames and `events.json`, no thrown errors. Assemble each with `assemble()` and watch them: actions human-paced, spotlights on the right elements, nothing anti-goal on screen.
- [ ] **Step 3: Rehearse the tx group once on production** (transactions are real testnet either way): `node scripts/preflight.mjs` → exit 0; `node record/run.mjs --group tx`. Expected: 7 confirmed transactions in `video/out/take-log.jsonl`; check each with `cast receipt <hash> status --rpc-url https://rpc.test.mezo.org` → `1`. Watch the assembled take.
- [ ] **Step 4: Fix scene scripts** until both groups pass without thrown errors and without anti-goal frames. Then run `node scripts/reset.mjs` and `node scripts/preflight.mjs` → exit 0.

---

### Task 7: Render pipeline and final takes

**Files:**
- Create: `video/render/render.mjs`, `video/render/describe.mjs`
- Test: `video/test/render.test.mjs`

**Interfaces:**
- Consumes: `keptSegments`, `outputTimeline`, `mapTime`, `musicPlan` (Task 1); `spotRect`, `chipHtml`, `spotHtml`, `overlayFilter`, `renderPng` (Task 2); `assemble` and `events.json` (Task 4); take dirs (Task 6).
- Produces:
  - `planRender(takes: Array<{ dir, events }>): { scenes: Array<{ id, segments, outStart, outEnd }>, overlays: Array<{ kind: "chip" | "spot", sceneId, rect?, start, end }>, totalSec: number }` (pure; spotlights mapped with `mapTime`, a spotlight overlapping a cut is an error).
  - `node render/render.mjs --takes <dir...>`: assembles each take, cuts per `segments`, concatenates in scene order (hard cuts), renders chip/spot PNGs, applies `overlayFilter`, builds the music with `musicPlan` (`atrim` + `acrossfade=d=3`, `afade=t=in:d=1`, `afade=t=out:st=fadeOutStart:d=3`, `loudnorm=I=-19:TP=-1.5:LRA=11`), muxes to `video/out/mezoroute-demo.mp4`.
  - `node render/describe.mjs`: writes `video/out/description.txt` from the app link, mainnet executor `0x046449b1229C863e278f369869BA10e12bd80d9E`, `https://github.com/hms1499/MezoRoute`, and the Uppbeat credit read from `video/credit.txt` (supplied by the user); exits 1 with a clear message if `credit.txt` is missing.

- [ ] **Step 1: Write the failing tests** for `planRender` with a synthetic two-take input: scenes ordered by id across takes; total equals the sum of kept segments; every scene has exactly one chip overlay spanning its output range; a spot inside a cut throws; `totalSec > 180` throws.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** `render.mjs` and `describe.mjs`.
- [ ] **Step 4: Run** `npm test` → PASS. Render the rehearsal takes: `node render/render.mjs --takes video/takes/*`.
- [ ] **Step 5: Verify the file:** `ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt -show_entries format=duration video/out/mezoroute-demo.mp4` → `h264`, `1920`, `1080`, `30/1`, `yuv420p`, `aac`, duration ≤ 180. `ffmpeg -i video/out/mezoroute-demo.mp4 -af ebur128 -f null - 2>&1 | tail -12` → integrated ≈ −19 LUFS. Make a contact sheet (`ffmpeg -i … -vf "fps=1/3,scale=480:-1,tile=6x10" sheet.png`) and check every scene has its chip and a spotlight.
- [ ] **Step 6: Final takes on production:** `node scripts/reset.mjs`, `node scripts/preflight.mjs` (if it reports a paused Stability Pool, run `node scripts/liquidate-if-paused.mjs`, then preflight again), `node record/run.mjs --group read`, `node record/run.mjs --group tx`, then render. Re-shoot any read scene alone; re-shoot the tx group only as a whole (reset first).
- [ ] **Step 7: Verify every hash** in `take-log.jsonl` has receipt status `1`, and that the receipt figures on screen match the explorer for at least the enter, borrowAndEnter and exit transactions.

---

### Task 8: Hand-off

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1:** Give the user `video/out/mezoroute-demo.mp4`, the contact sheet, and the take log; list anything not shown as the spec describes (e.g. Claim BTC gain disabled because the gain was 0).
- [ ] **Step 2:** After the user's review, apply requested changes (re-render, or re-shoot a scene group).
- [ ] **Step 3:** When the user accepts, run `node render/describe.mjs` (needs `video/credit.txt`), then update `docs/STATUS.md` (D1 row: video done, file is local in `video/out/`, not committed; session log line) and commit: `git add docs/STATUS.md && git commit -m "docs: STATUS with the D1 demo video"`.
