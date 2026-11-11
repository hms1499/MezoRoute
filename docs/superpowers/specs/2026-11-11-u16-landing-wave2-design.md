# U16 Landing for Wave 2 — design

**Date:** 11 Nov 2026 · **Branch:** `feat/u16-landing-wave2` · **Approved:** in chat, 11 Nov (the user asked to build the agent's review items 1, 2, 3, 5 and 6 straight away, and to fix any UI/UX bug found on the way; prerendering the landing, item 4, is a later pass).

## Intent

The landing (`/` before a wallet connects) still tells the Wave 1 story: it compares LP and the Stability Pool, then sends everyone to Connect. Wave 2 added Trove actions (Open with leverage, Unwind, Close, Leverage), entry from BTC, MEZO staking, and a read-only planner (U13). None of these appear on the landing, and the planner, which needs no wallet, is not linked from it. The caps it states are also only part of the picture.

## Changes

1. **Hero sub-copy** names the Wave 2 scope: "Compare the MUSD/BTC pool with the Stability Pool on live Mezo data, enter in one transaction from MUSD, BTC, or a new borrow, and unwind your Trove the same way. Non-custodial." The headline, the route motif, the figures, and both hero buttons stay (they are the brand hero the user wants kept).
2. **Planner links.**
   - `Landing` owns the simulator amount (lifted from `SimulatorSection`), so every link below carries it. It uses `plannerHref(route, amount)` from `src/lib/landing/links.ts`, which writes `/route/lp/?amount=…` or `/route/stability-pool/?amount=…` with the last valid amount as a plain decimal.
   - The simulator's bottom action becomes a link to the LP planner: "Plan this amount" (no wallet needed). It replaces "Connect wallet to choose a route".
   - The LP section's button becomes "Plan an LP deposit" (LP planner) and the Stability Pool section's becomes "Deposit to the Stability Pool" (its route page, which asks for a wallet). The three identical "Compare routes" anchors are gone; the hero keeps its one.
3. **A third section, "Your Trove"**, after the two routes:
   - Same rhythm and frame as the route sections, with the illustration on the right.
   - Copy lives in `ROUTE_SECTIONS` beside the others (route id `trove`):
     - pill "Your Trove";
     - title "Unwind, close, or lever up in one transaction";
     - body: "A flash swap on the MUSD/BTC pool repays debt from your collateral or adds BTC with new debt, so you never need MUSD in your wallet first." and "Every page shows the swap's cost against Mezo's oracle and your place in the redemption queue before you sign.";
     - txs line: "Sign a Trove authorisation and a permit, then send one transaction. EVM wallets only."
   - Its action is a Connect button, "Connect to manage your Trove": the Trove actions live on the Dashboard's Trove card.
   - It does not highlight the simulator's chart (the chart has no Trove line).
   - Its illustration, `TroveIllustration`, is decorative and drawn with the same primitives as the LP one.
4. **Caps and contracts.** One function, `mainnetCaps(network)` in `src/lib/landing/caps.ts`, reads the caps from `networks.mainnet`:
   - entry caps: `entryCap`, `entryCapBtc`;
   - Trove caps: `leverage.maxMusdFlash`, `leverage.maxBtcFlash`.

   It returns the sentence "1,000 MUSD or 0.0125 BTC per entry, 2,500 MUSD or 0.0125 BTC per Trove action". It is used by:
   - TrustRow "Capped": "Per transaction on mainnet: …".
   - `MainnetBanner`: "Unaudited · max …", plus a second link "Trove contract" when `network.leverage` is set.
   - TrustRow "Source-verified": links to both mainnet contracts.
   - TrustRow "Unaudited": adds "Trove actions have not yet run end to end on mainnet." (the same fact the Trove pages state, `MAINNET_NOT_RUN`).
5. **How it works** becomes Plan → Sign → Manage, titled "Plan, sign, manage: every number before you sign":
   - **Plan:** "Both routes for one amount, no wallet needed: fees, MEZO, BTC exposure, and the last 30 days on chain."
   - **Sign:** "Exact amounts and minimums from one block: one transaction in from MUSD, BTC, or a new borrow, after any approval your wallet needs."
   - **Manage:** "Stake, claim, and exit from Positions (staked LP unstakes first); unwind or close your Trove in one transaction."
6. **Footer:**
   - The tagline becomes "Route MUSD on Mezo, see the BTC risk, and manage your Trove in one transaction."
   - "Executor contract" is joined by "Trove contract" (`network.leverage`).

## Fewer words, more icons (user request, 11 Nov, mid-build)

The user asked to swap words for icons wherever an icon can carry them. As built:

- **Route sections:** each section shows one body line, then the first risk behind a warning icon. The "how it is sent" sentence became icon chips (`facts`: Zap one transaction, PenLine signatures, LogOut exit, Gauge oracle and queue, Wallet EVM only).
- **How it works:** the numbers became icons (Calculator, PenLine, SlidersHorizontal), each with one short line. The heading is "Plan, sign, manage".
- **Trust row:** shorter lines. The Trove section body is one sentence plus "No MUSD needed first."
- **Hero sub-copy, shorter than in item 1:** "Compare routes on live Mezo data, enter in one transaction, and unwind your Trove the same way."
- **Simulator:** its link carries a Calculator icon.

## UI/UX fixes found during the build

- **Mainnet banner:** at 360 px it ran to three lines of caps and pushed the shield icon off its line. It now reads "Unaudited · capped per transaction", with the two contract links; the caps are spelled out in the trust row and on each flow. This replaces item 4's banner wording.
- **Hero sub-copy:** it left one word alone on its last line at 1440 px. It is now balanced (`text-wrap: balance`).
- **Simulator table:** at 1440 px its row labels ("Return source", "MezoRoute fee") wrapped to two lines. From 640 px they stay on one line.
- **Section copy:** the LP and Stability Pool return-source lines had no full stop as section copy. The section adds it; the shared copy source, also used in tables, is unchanged.

## Non-goals

Prerendering the landing (later pass); a BTC amount in the simulator; changing the hero headline, the motif, or the live figures; any transaction code.

## UI/UX bugs found during the build

Fixed on this branch with a test where one can pin it. Each is listed in `docs/STATUS.md`.

## Checks

- `npm test` and `npm run build` pass. The tests pin the new copy, `plannerHref`, `mainnetCaps` (from the config values, not literals), the section order, and the illustration sides.
- The QA pass drives the landing with Playwright on the local export, in both themes and at 360, 768 and 1440 px. It checks:
  - no horizontal scroll and no console errors;
  - the planner links open `/route/lp/?amount=<typed amount>`;
  - the mainnet banner and footer show both contract links.
