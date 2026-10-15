# U1 — UI polish (design)

Date: 15 Oct 2026 · Task: U1 in `PRODUCT_SPEC.md` §16 · Depends on: every F task, M1 · Branch: `feat/u1-ui-polish`

## Goal

A Wave 1 judge opens the public URL and, within the first 30 seconds, sees a polished, trustworthy DeFi product and understands what MezoRoute does. U1 is one pass over every screen for visual consistency, information hierarchy, loading/empty/error states, the first impression before a wallet connects, and micro-interactions, within the §9 "Calm Finance" direction.

The user approved this design in four sections on 15 Oct 2026 (direction: upgrade Calm Finance, not a new style; approach A: design system first, then screen by screen).

## Constraints

- **No new features and no logic changes.** Transaction flows, quotes, gates, reads, and sends stay as they are. `src/lib/**` changes only for display helpers (new, unit-tested) and two copy rules listed below.
- §9 copy rules still hold: no "guaranteed"/"risk-free", "estimated" before confirmation, one sentence per risk before detail, testnet execution data visually and textually separate from mainnet reference data, no MEZO/gauge reward claims.
- Works at 360 px wide with no horizontal scroll; 635 Vitest tests keep passing; `npm run build` (lint, types, relayer bundle check) passes on every commit.
- Version pins in `AGENTS.md` stay. One new dependency: `lucide-react`, pinned to an exact version at least two weeks old.
- Design research came from the `ui-ux-pro-max` skill (style "Minimalism & Swiss", fintech typography, the accessibility/interaction rule set). Its suggested dark gold/purple palette was rejected: it contradicts the approved light direction.

## Decisions

| Topic | Decision |
|---|---|
| Approach | Tokens and shared UI components first (`src/components/ui/`), then screens in order: chrome → landing → dashboard → route pages → confirm/receipt → positions → motion and accessibility pass. Each step is its own commits and leaves the app working. |
| Font | Inter (variable) through `next/font/google`, `display: "swap"`, exposed as `--font-inter` and Tailwind `font-sans`. Downloaded at build time and self-hosted in the export. Fallback if the build cannot fetch it: self-host the `woff2` from `public/` with `next/font/local`. |
| Numbers | Every amount, price, percentage, and table cell uses `tabular-nums`. Signed changes always carry `+`/`−`; colour never carries meaning alone. |
| Type scale | 12 / 14 / 16 / 20 / 24 / 32 px; weights 400 (body), 500 (labels), 600 (headings, key figures). Body text ≥ 14 px; 11 px footnotes become 12 px. |
| Colour | Keep the tokens in `tailwind.config.ts` (canvas, ink, muted, line, accent teal `#0F766E`, warning, danger). Add `btc` (`#C2410C`, soft `#FFF4EC`) used only to mark BTC-exposure figures and badges, never for buttons. Add `success` for confirmed states (teal-based, with an icon). Every text/background pair ≥ 4.5:1, checked by a script during QA. |
| Surfaces | White cards, 16 px radius, 1 px `line` border, one shadow scale (`card`, `raised` for sticky panels). Sections inside a card are split by dividers, not nested cards. |
| Icons | `lucide-react`, stroke 1.75, sizes 16/20/24. Decorative icons carry `aria-hidden`; icon-only controls carry an accessible name. No emoji (the banner's "⚠" becomes an icon). |
| Logo | An SVG mark (two route lines meeting in one node), in teal, used in the header and as `app/icon.svg` (the favicon currently 404s). |
| Motion | 150–200 ms ease-out for hover/press and state changes; value updates crossfade; skeletons shimmer. All animation is behind `motion-safe:`; `prefers-reduced-motion` gets the final state immediately. No animation of width/height. |
| Focus and targets | Visible 2 px teal focus ring (`focus-visible`) on every interactive element; buttons and inputs ≥ 44 px tall; `cursor-pointer` on clickable elements; disabled = 50% opacity + `disabled` attribute. |
| Wallet button | RainbowKit `lightTheme({ accentColor, borderRadius, fontStack })` matched to the app's buttons; no CSS overrides into the library. |

## 1. Shared UI components (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Card` | Surface with optional header (title, subtitle, right-hand slot) and divided sections. Variant `reference` (dashed border, muted background) for mainnet reference data. |
| `Button` | `primary` / `secondary` / `ghost` / `danger`, sizes `md` (44 px) and `sm`; `loading` state with spinner; renders a link when given `href` (external links get an icon and `rel="noreferrer"`). Replaces `ExternalButton` and ad-hoc button classes. |
| `Badge` | Small status label: `neutral`, `accent`, `btc`, `warning`, `danger`. |
| `Stat` / `StatList` | Label + tabular value (+ optional sub-value), stacked or as a two-column list. Replaces `StatRow`. |
| `Notice` | `info` / `warning` / `danger` block with icon, message, optional action. Used for blocks, Trove warnings, wrong network, load errors. |
| `Skeleton` | Shimmering placeholder shaped like the content it replaces; containers carry `aria-busy`. |
| `PageHeader` | "← Dashboard" back link, page title, and the flow progress (① Amount ─ ② Confirm ─ ③ Done) on route/confirm/receipt pages. |
| `Logo` | The SVG mark, with and without the wordmark. |

## 2. Chrome

- **Header:** logo; nav ("Dashboard", "Positions") with the current page marked (`aria-current`, weight + underline); network switch; wallet button. At 360 px the wordmark hides and nothing wraps.
- **Mainnet banner:** a slim bar with a shield icon: "Unaudited · max 1,000 MUSD per transaction" plus a "Verified contract" link to the executor on the explorer.
- **Error toast:** restyled as a `Notice` in a fixed, polite live region; still always carries its recovery actions; never shows raw error text (unchanged rule).
- **Footer:** "Unaudited software", testnet tokens note on testnet, links to the executor on the explorer and to the GitHub repository.

## 3. Landing (no wallet connected)

```
Hero (left)                                   Live card (right, "Mezo mainnet · live")
  Put your MUSD to work, and see what it        Pool value, LP fees last 30 days,
  does to your BTC risk.                        Stability Pool deposits
  one-sentence subcopy
  [Connect a Bitcoin or EVM wallet]  How it works ↓
  Trust row: Non-custodial · Source-verified contract · Max 1,000 MUSD per transaction on mainnet

Two routes for your MUSD
  MUSD/BTC LP: Earn swap fees · return source · main risk
  Stability Pool: Back the system · return source · main risk

How it works: ① Compare routes ② Preview the exact transaction ③ Sign, and exit any time

Footer
```

- The live card reuses `useMainnetReference` and `referenceView` (F8): no new data code, cached with the same query key as the dashboard's reference card. It is labelled "Mezo mainnet" on both networks. Loading shows a skeleton; on error the card is not rendered and the page stays complete.
- On mobile the live card follows the hero and the route cards stack.
- Route-card text comes from `src/lib/routes/copy.ts` (no duplicate copy).

## 4. Dashboard (connected)

- **Layout:** `max-w-6xl`; from 1024 px a main column (2/3) and a side column (1/3); below that one column in priority order: warning → summary → next step → compare routes → BTC exposure → Trove → positions → mainnet reference.
- **Summary strip:** wallet MUSD · BTC for gas · total BTC exposure (`btc` colour) · Trove CR (or "No Trove"). Values from the existing dashboard snapshot.
- **Next step** (was the readiness card): one sentence and one CTA per readiness state. Copy change: on **mainnet** with no MUSD and no Trove, the detail reads "Swap BTC for MUSD in the Mezo app. Opening a Trove needs at least 1,800 MUSD of debt." (Mezo mainnet minimum net debt, checked in M1a.) Testnet copy is unchanged.
- **Compare routes** becomes a comparison table: row labels on the left, one column per route, so like values align. Rows that need an amount (position after, BTC exposure, −30%) are hidden until an amount is entered and replaced by one hint line. Each route shows its main risk sentence; the others sit in a `<details>` "More risks". Below 640 px the two columns become tabs ("MUSD/BTC LP | Stability Pool") sharing the one amount input.
- **Side column:** Trove card, BTC exposure (with the −10/20/30% table), positions summary.
- **Mainnet reference card** (testnet only) spans the full width at the end, `Card` variant `reference`.
- **Loading:** a skeleton with the same layout as the content.

## 5. Route pages (LP, Stability Pool, LP exit, SP withdraw)

- **Frame:** `PageHeader` (back link + flow progress at step ①). From 1024 px a form column (2/3) and a sticky summary panel (1/3): what you put in, what you receive (estimated), fee, price impact, network fee, the block reason (a `Notice`, right above the button), and the primary button (Review / Exit / Withdraw). Below 1024 px a fixed bottom bar carries the key figure and the button; page content gets bottom padding so nothing hides behind it.
- **Form column:** mode toggle (LP), amount with Max and wallet balance, slippage chips, "What happens" steps, BTC exposure before → after with the drawdown table (one card; the separate before/after cards merge), risks.
- **Copy rule fix:** the double-exposure sentence ("Borrowing MUSD against BTC and adding it to the MUSD/BTC pool raises your BTC exposure…") shows only when the snapshot shown has both a Trove and LP exposure. Today it shows on every exposure panel, including the Stability Pool page and Deposit mode with no Trove.

## 6. Confirm and receipt

- **Confirm pages** (LP, SP, exit): `PageHeader` at step ②; the exact-amounts summary (amounts, minimums, deadline), the no-custody sentence, and the 60 s quote expiry as a thin progress bar with the remaining seconds in text.
- **Stepper:** vertical, numbered nodes joined by a line. Status shown with icon and text: pending (number), awaiting wallet (wallet icon, "Check your wallet"), submitted (spinner, "Confirming"), done (check), failed (x, message, "Try again"). The active step is emphasised, later steps dimmed. Status changes are announced in a polite live region.
- **Receipt:** `PageHeader` at step ③; a large status icon (spinner / check / x) with a Submitted → Confirming → Confirmed timeline; event-derived values in a `StatList`; buttons "View positions" (primary), "View on explorer" (secondary, external icon), and a "Back to dashboard" link.

## 7. Positions

- Page header with total position value and total BTC exposure.
- LP card and Stability Pool card: the main figure large; underlying, cost basis, and claimable fees/BTC gain in a `StatList`; actions as `Button`s (Exit, Claim fees, Withdraw, Claim BTC gain).
- Empty state: an icon, one sentence, and two buttons to the two routes.
- Loading skeleton matching the cards.

## 8. Testing and QA

- **Unit tests (TDD), Vitest:**
  - mainnet/testnet "Next step" copy for the no-MUSD, no-Trove state;
  - comparison rows shown/hidden by amount;
  - signed and tabular formatting helpers;
  - the double-exposure sentence rule;
  - landing live-card state (loading / data / hidden on error);
  - header active-link matching.
- **No component test framework** is added (none exists in the repo); components are checked by QA.
- **QA (Playwright + keyless mock wallet, per `docs/STATUS.md`):**
  - every screen at 360, 768, 1024, 1440 px;
  - accounts: testnet no-Trove, can-borrow, at-risk, and the mainnet M1 account `0x375a…d6e8`;
  - loading (delayed RPC), error (aborted RPC), and empty states;
  - keyboard-only pass (tab order, focus ring visible, nothing hidden behind the sticky bar);
  - `prefers-reduced-motion: reduce`;
  - contrast script over the token pairs;
  - no horizontal scroll at 360 px.
- **Every commit:** `npm test` and `npm run build`.

## 9. Order, estimate, and cut line

| # | Step | Estimate |
|---|---|---|
| 1 | Tokens, Inter, `lucide-react`, logo/favicon, RainbowKit theme, `src/components/ui/*` | 0.5 day |
| 2 | Header, banner, toast, footer, `Notice` replacing ad-hoc alerts | 0.25 day |
| 3 | Landing with live card and route cards | 0.5 day |
| 4 | Dashboard layout, summary strip, Next step, comparison table (+ mobile tabs) | 0.75 day |
| 5 | Route-page frame applied to LP, SP, exit, withdraw | 0.75 day |
| 6 | Confirm stepper and receipt | 0.5 day |
| 7 | Positions | 0.25 day |
| 8 | Motion, accessibility pass, full QA | 0.5 day |

Target: done by 19 Oct 2026, leaving 20–21 Oct for V1 and up to 25 Oct for D1.

If time runs short, cut in this order: (1) mobile tabs in the comparison (keep stacked columns), (2) the quote-expiry progress bar (keep the text), (3) the receipt timeline (keep the status icon). Steps 1–4 and the two copy fixes are never cut.

## 10. Risks

- **`next/font` in static export:** fetches at build time; Vercel builds have network. Fallback: `next/font/local` with the `woff2` in `public/`.
- **RainbowKit/Passport styling:** theme options only; no version change, no CSS reaching into the library.
- **Bundle size:** `lucide-react` icons are imported by name, so only used icons ship. Check First Load JS stays within +10 kB of today's 91.9 kB.
- **Logic regressions:** none expected (no `src/lib` behaviour change beyond the two copy rules); the full Vitest suite and the QA flows on both networks cover it.

## Done when

- Every screen in §9 of `PRODUCT_SPEC.md` uses the shared components and tokens, and passes the QA list above.
- `PRODUCT_SPEC.md` §9 describes the design system (Inter, `btc` marker colour, two-column layouts, the mainnet Next step copy); `AGENTS.md` gains one frontend bullet on the design system; `docs/STATUS.md` marks U1 done.
