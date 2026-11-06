# U11: one design system and a dapp layout

**Status:** design approved in chat on 6 Nov 2026; this document is awaiting the user's review.
**Branch:** `feat/u11-dapp-ui` (from `main` at `e73b5bf`).
**Deadline context:** Wave 2 closes 13 Nov 2026. Unwind and Leverage have not started. U11 ships in two phases that each merge on their own, so the work can stop after Phase 1 and the app is still better than today.

## 1. Intent

The user wants MezoRoute to feel like a real web3 dapp, on the level of **Aave** and **Aerodrome**, which they use themselves. They also want every component (buttons, inputs, cards, font sizes, spacing) to follow one system, the way a professional product does.

Today the app looks like a report. Pages are long and full of prose, figures sit inside sentences, and the same kind of control looks different from page to page. A dapp is compact and hands-on: a token chip in the amount field, a balance with Max, a short transaction overview, one clear action, and explanations moved behind "Details".

The project already has a strong base: two palettes with contrast tests, a type scale, a motion system, and guard tests that fail the build when a rule is broken. What it lacks is the rest of the system (radius, spacing, control sizes, surface layers, semantic colours, one segmented control) and a single document that holds it.

## 2. Goals, non-goals, anti-goals

**Goals**
1. One `DESIGN.md` that holds the whole design system: YAML tokens, prose rules, components, do's and don'ts, and agent guidelines. It uses the format of the user's reference file (`~/Downloads/DESIGN.md`, "DeFi Core"), filled with MezoRoute's own values.
2. Every gap the 6 Nov audit found gets a token and a guard test, in the same style as `typography.test.ts`, `motion-guard.test.ts`, `palette-guard.test.ts`, and `icon-guard.test.ts`.
3. One font across the app: **Geist Mono**.
4. A dapp layout for the flow pages, the Dashboard, and Positions, matching the mockups the user approved (§6).
5. All ten audit findings fixed (§4).

**Non-goals**
- No new colours or identity. The teal accent, two palettes (light is the default), lavender for the Stability Pool, orange only for BTC exposure, and the U10 motion system all stay.
- No new features, no contract changes, and no change to how transactions are built, simulated, or sent (`sendCall`, `writeBlocker`, permits, gas budgets).
- The landing page keeps its U10 layout (hero, simulator, route sections, How it works, Trust, final CTA). It takes the new font and tokens only.

**Anti-goals** (a failure even if everything renders)
- **Risk hidden before signing.** Every risk line the route pages show today must still be visible before the user signs. On the amount page risks may collapse to one line plus "Details". The Confirm page shows them in full.
- **Copy rules broken.** An APR always says it is this week's rate. Staking copy always says swap fees go to veBTC voters. Never "guaranteed" or "earn X%". The Stability Pool is never annualised.
- **Fake precision.** No "≈ $" line under MUSD amounts. MUSD is already about one dollar, so a dollar figure adds nothing and can mislead.
- **Regressions in what QA already proves.** No horizontal scroll at 360 px. Every text pair in both palettes reaches 4.5:1. Reduced motion is honoured. The wallet tree never re-renders.

## 3. Constraints

- The stack is pinned (`AGENTS.md`: Next 14.2.35, React 18.3.1, wagmi 2.19.5, RainbowKit 2.0.2, Passport 0.17.2). Don't upgrade anything for this work.
- Every rule in `AGENTS.md` → Frontend still holds unless this document changes it explicitly (§5.10 lists the changes).
- **Geist Mono is not in `next/font/google` for Next 14.2.35** (checked: absent from the bundled font data). Self-host it with `next/font/local`. The font is OFL-licensed. Take the woff2 files from Vercel's `geist` package or the Geist repository, commit them under `frontend/src/fonts/`, and keep the licence file next to them.
- **A monospace font is wider than Inter** (about 15–20% at the same size). The 360 px header and route pages already have no room to spare. QA at 360 px is a hard gate for every page.
- Pushing `main` deploys production, so each phase merges only on the user's word.
- Token icons for MUSD, BTC, and MEZO come from the user. On 6 Nov they sent three images in chat (about 64 px): a pink circle with a white ring and swirl (MUSD), the orange Bitcoin circle (BTC), and a pink rounded square with a white wave (MEZO). The user then supplied the files (`~/Downloads/icon`: 64 px WebP, JPEG, and PNG); they were converted to 64 × 64 px PNG (enough for the 24 px icon on 2× screens) and kept in `.superpowers/u11/tokens/` for Task 9. MEZO's JPEG has no transparency, so `TokenIcon` crops every icon to a circle in CSS. Until they land, `TokenIcon` renders a fallback: a circle in the token's colour with its first letter. Phase 2 is not blocked on the files.

## 4. Audit findings (6 Nov 2026)

The audit ran Playwright with the keyless mock wallet on the local `main` build. It covered 13 screens at 360 and 1440 px (26 light-theme page loads, plus dark screenshots), using the user's mainnet account (staked LP) and the testnet "can borrow" account. There was no horizontal scroll and no app console error. The screenshots and the throwaway script were deleted on 6 Nov at the user's request; the repeatable check is `npm run ui-audit` (`frontend/scripts/live/ui-audit.live.ts`, §7).

**Already consistent:**
- Cards: 62 of them, all 16 px radius, 20 px padding, 1 px border.
- Buttons: all pill-shaped. Primary buttons are 44 px tall, text 14/600.
- Amount inputs: the same on every app page (48 px box, 12 px radius, text 20/600).
- Icons: lucide icons follow the U10 rule (163 at 16 px, 38 at 14 px).
- Tables inside the app.

**Findings, and the phase that fixes each:**

| # | Finding | Fix |
|---|---|---|
| 1 | Segmented controls show **four different selected states**: solid accent (slippage, exit %), `line` grey (Deposit / Borrow, MUSD / BTC), white chip (Dashboard / Positions), `selected` tint (Testnet / Mainnet, Light / Dark). Two of these sit side by side in the header. | P1: one `Segmented` component (§5.6) |
| 2 | Buttons come in four heights (44 / 40 / 36 / 28), six horizontal paddings (20 / 14 / 12 / 10 / 8 / 0), and four text styles. "Max" has two versions: 12 px on a tint on the route pages, 14 px with a border on the exit page. | P1: control sizes (§5.4) and a single Max (§5.6) |
| 3 | Several primary buttons in one view. Positions has three filled buttons (Exit, Claim MEZO, Claim fees); the Dashboard has three (Compare routes, Choose LP, Choose Stability Pool). | P1 rule (§5.7); P2 layout |
| 4 | An empty state in the error colour: "You have no fees to claim yet." is red with an error icon. | P1: notice tones (§5.5) |
| 5 | The same figure in two type styles: on Positions, "2.2914 MUSD" is mono 28 px in the card and sans bold in Totals. The landing input is JetBrains Mono 24 px; app inputs are Inter 20 px. | P1: one font (§5.1) and figure roles (§5.2) |
| 6 | Headings drift. The Dashboard has no `h1` while flow pages have a 28 px `h1`. One landing `h2` is 28 px while the others are 24 px. The landing comparison table shows the browser's default `th` (700 weight, centred), which breaks the 400/500/600 rule. | P1 (§5.2) |
| 7 | No radius or spacing scale: six radii (9999 / 16 / 12 / 8 / 4 / 2 px), 17 different `gap` pairs, and off-grid padding (14, 10, 6, 2, 1 px). | P1 (§5.3) |
| 8 | Touch targets at 360 px. The network and theme switches are 28 px tall. Footer links and "Verified contract" are 16–20 px, below WCAG 2.5.8's 24 px. Presets and header controls are 36 px. | P1 (§5.4) |
| 9 | 12 px text is overused: about 860 runs of 12 px text against about 1,080 of 14 px, and explanations sit at 12 px. | P1 rule (§5.2); P2 removes most of that prose from view |
| 10 | Compare routes: the "Last 30 days" and "20 MUSD on Oct 6" rows rendered as very pale text in the screenshot (possibly a loading state captured mid-fetch). | P1: check it first; if it is a loading state, use `Skeleton`; if it is a real contrast failure, fix it |

## 5. Phase 1: the foundation

### 5.1 One font: Geist Mono

- Geist Mono replaces both Inter and JetBrains Mono everywhere, landing included, self-hosted through `next/font/local` (§3). Load the variable font if the files allow it; otherwise load weights 300, 400, 500, and 600 (300 is for display type only).
- `fontFamily.sans` and `fontFamily.mono` both point at `var(--font-geist-mono)` with a monospace fallback stack. Keeping both names avoids touching every `font-mono` class. A guard (§5.9) checks the two stay identical, and that nothing imports `Inter` or `JetBrains_Mono`.
- U3's rule "mono only for key figures" goes away, because everything is now mono. Figures stand out by size and weight (§5.2), not by switching font.
- Tracking: the current negative tracking (`-0.025em` on `headline`, `title`, `figure`; `-0.02em` on display) was tuned for Inter. Re-tune it for Geist Mono and record the values in `tokens.ts`. **Builder's call**, with one limit: tracking may never make 360 px text overflow or letters touch.
- Inter's tabular-figure workaround (`globals.css` sets `tabular-nums` on `dd`, `td`, `th`, `input`, `output` only) is no longer needed, because every glyph in a monospace font is the same width. Keep the rule or remove it; either way it must not change how anything renders.

### 5.2 Type roles

The U6 scale stays as it is (`xs` 12, `sm` 14, `base` 16, `xl` 20, `headline` 24, `title` 28, `figure` 28, `display` 40/48). What changes is that each size now has a named role, written in `DESIGN.md`:

| Role | Token | Weight | Use |
|---|---|---|---|
| Page title (`h1`) | `title` | 600 | **Every** app page has exactly one visible `h1`, the Dashboard included |
| Landing section title (`h2`) | `headline` | 600 | All landing `h2`s (fixes the one 28 px `h2`) |
| Card title (`h2`/`h3`) | `base` | 600 | Card and section headers |
| Key figure | `figure` | 500 | The one big figure of a card or overview |
| Secondary figure | `xl` | 500 | Stats strip values, "You receive" |
| Body | `sm` | 400 | Default text; explanations |
| Label | `sm` | 500 | Field labels, overview row labels |
| Caption / meta | `xs` | 400 | Table headers (500), badges (500), chart text, timestamps, "In your wallet" lines |

Rules:
- 12 px is only for captions, table headers, badges, and chart text. A full explanatory sentence is at least 14 px. This is enforced by review and the QA script (§7), because no test can reliably tell a sentence from a label.
- Weights stay at 400 / 500 / 600 (300 for display only). Every `th` gets an explicit weight and alignment, so the browser default never shows (fixes #6).
- The same figure has the same role wherever it appears (fixes #5). For example, a position's value is `xl/500` in both the row and the totals.

### 5.3 Radius and spacing scales

**Radius.** This replaces Tailwind's scale, the same way U6 replaced `fontSize`, so an off-scale class does not exist:

| Token | Value | Use |
|---|---|---|
| `rounded-pill` (`rounded-full` stays as an alias) | 9999 px | Buttons, segmented tracks and items, badges, chips, toggles, avatars, token icons |
| `rounded-card` | 16 px | Cards and panels |
| `rounded-inset` | 12 px | Wells inside cards: inputs, the overview box, chart surfaces, notices |
| `rounded-tip` | 8 px | Popovers, tooltips, menus, toasts |
| `rounded-none` | 0 | |

The landing's `.landing-frame` (4 px) is a named exception in the guard. The 2 px radius the audit found (44 instances) is mapped by the builder to `none` or `tip`, whichever it really is.

**Spacing.** The base unit is 4 px. Allowed steps are 0, 0.5 (2 px; hairline offsets and the inner padding of a segmented track only), 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, and 24, applied to padding, margin, gap, `space-*`, and inset. The half steps 1.5, 2.5, and 3.5 (6, 10, 14 px) and arbitrary values (`gap-[3px]`) are not allowed. Named defaults:
- card padding 20 (`p-5`), and 16 on a card nested in a card;
- inset padding 12;
- gap between cards 12;
- gap between page sections 24 (32 on the landing);
- gap inside a control row 8.

### 5.4 Control sizes and touch targets

| Size | Visual height | Horizontal padding | Text | Use |
|---|---|---|---|---|
| `lg` | 44 px | 20 px | `sm` / 600 | The page's primary action, full-width card actions |
| `md` | 36 px | 16 px | `sm` / 600 | Secondary actions, row actions in tables, segmented items, presets |
| `sm` | 28 px | 12 px | `xs` / 600 | Header switches (network, theme), Max, small inline actions |
| `icon` | 36 × 36 px | – | – | Icon-only buttons |

- `Button` sizes become exactly these. The current `md` and `sm` map to `lg` and `md` by height; `sm` is new.
- The arrow circle follows the size: 28 px circle on `lg`, 24 px on `md`, and no arrow on `sm`.
- The dashboard's 40 px "MUSD/BTC LP" tabs and every other off-scale control move onto the table.
- **Hit area.** Every interactive element has a hit area of at least 24 × 24 px at every width (WCAG 2.5.8), and at least 44 × 44 px below 768 px. A control that looks smaller than that gets the extra area from a transparent `::after` (the `.hit` utility), not from a bigger visual size. Footer links and "Verified contract" get the 24 px minimum at every width (fixes #8).
- **Inline targets are exempt** (my call, as WCAG 2.5.8 does): a `Term` trigger inside a label or heading, and a link inside a sentence, keep their text size and get no `::after`, because a 44 px area would cover the controls next to them. The guard and the QA script skip an element whose nearest block ancestor contains other text runs.

### 5.5 Colour roles added

The palette and its two themes stay. These roles are added, each in both themes, each passing 4.5:1 in `textPairs`:

- **`positive`**: a green for gains, only on signed financial figures (a 30-day result, a P&L, a value change). It always comes with a sign (`+`) so colour is never the only cue. The values are the builder's call. Light needs about `#15803D` to pass on `canvas`, `surface`, and `well`. Dark should be a lighter green, and it must stay clearly different from the teal accent in both themes.
- **`negative`**: the same hue as `danger`, under its own name, for signed losses (`−1.09 MUSD (−5.49%)`). `danger` stays for errors and destructive actions only.
- **Notice tones.** `Notice` gets exactly four tones: `neutral` (ink on `well`, info icon), `warning`, `danger`, and `success`. An empty or "nothing to do" state is `neutral`, never `danger` (fixes #4). The red line on Positions comes from `NOTHING_TO_CLAIM`, a `BlockedError` outcome (`src/lib/positions/claim.ts`), so the fix lands where outcomes are rendered: an outcome gains a tone, `NOTHING_TO_CLAIM` (and any other "nothing to do" outcome the builder finds) is `neutral`, and a test pins it. Better still, the Rewards card (§6.4) does not offer Claim fees when there is nothing to claim.

### 5.6 Surfaces and shared controls

**Surface layers**, written in `DESIGN.md`:
1. `canvas`: the page.
2. `surface`: cards and panels (1 px `line` border, no shadow; the U3 rule stays).
3. `well`: insets inside a card.
4. **Overlay**: popovers, menus, toasts, the wallet modal. These are `surface` plus one shadow token, `shadow-overlay`. It is the only shadow in the app, and a guard rejects any other `shadow-*`.

**`Segmented`** (`src/components/ui/Segmented.tsx`) is the only segmented control. It has a `well` track with 4 px padding (2 px for `sm`). Items are pills; the selected item is a `surface` chip with a 1 px `line` ring and `ink` text, and unselected items are `muted` text. The same look is used in both themes and everywhere:
- the footer theme switch (`sm`);
- Deposit | Borrow & Deploy;
- the asset switch, until Phase 2 replaces it (§6.2);
- the mobile Compare tabs;
- slippage and exit-percentage presets (`md`).

It renders `role="radiogroup"` with radio semantics, or `tablist` for tabs, by prop. The header nav (Dashboard | Positions) is links, not a radio group, but it uses the same selected chip on a `well` track so the header shows one style (fixes #1).

**Network chip (my call, from the builder check).** Geist Mono is wider than Inter, `sm` padding is wider than today's, and `main` already runs about 9 px into the gutter at 360 px, so the header would overflow by roughly 40 px if it kept a two-item network switch. The network switch in the header therefore becomes one chip, the way Aave and Aerodrome show the chain: a coloured dot, the current network's name ("Testnet" or "Mainnet"), and a chevron. It is an `sm` button that opens a two-item menu (an overlay, §5.6). Choosing the other network keeps today's behaviour: store it, then reload. The menu is a `Segmented`-free `role="menu"`, so the `radiogroup` guard is unaffected. The theme control keeps U9's placement (an icon in the header from 768 px, the Light | Dark `Segmented` in the footer below). If 360 px still overflows after this, the builder may hide the account button's address text below 400 px, keeping the wallet icon. That is the only further give allowed; the nav link and Connect stay.

**Max** is one component: an `sm` pill with `accent` text on `accent-soft`, placed inside the amount field on the right. It is used by every amount input and every percentage preset group ("Max" in exit and withdraw becomes this, not a fourth preset style).

**Tables** get one `DataTable` style: header 12/500 `muted`, left-aligned for the first column and right-aligned for figures; rows 14/400 with 12 px vertical padding; a 1 px `line` divider; no zebra striping. Row headers (`th scope="row"`) are 14/400. The landing comparison table uses it (fixes #6).

### 5.7 Hierarchy rules

- **At most one primary (filled) button per view.** On a page with several cards, at most one card shows a primary. Two equal alternatives (Choose LP, Choose Stability Pool) are both `secondary`. Row actions in tables are `secondary` or `ghost`. The QA script counts visible primaries per page (§7).
- Hierarchy comes from weight and size, not colour alone (DeFi Core's rule, which matches U6).

### 5.8 Icons

| Kind | Sizes | Rule |
|---|---|---|
| UI icons (lucide) | 14 / 16 / 20 | Unchanged: the size follows the text beside it (U10 §8, `icon-guard.test.ts`) |
| Token icons | 16 inline in text, 20 in chips and table rows, 24 in card headers | `TokenIcon` (`src/components/ui/TokenIcon.tsx`) with `token: "musd" \| "btc" \| "mezo"` and `size: 16 \| 20 \| 24` only |
| Pair icon | Same sizes | `PairIcon`: two `TokenIcon`s overlapping by a third, the second with a 2 px ring in the current surface colour |
| Indicator circles (step numbers, numbered lists, How it works) | 24 | One size; the PageHeader step circles, "What happens", and How it works (28 px today) all become 24 |
| Logo | 28 header, 24 footer | Kept on purpose: the footer is one level down |

Token files go under `frontend/public/tokens/{musd,btc,mezo}.svg` (or `.png`) once the user supplies them. `TokenIcon` uses `<img>` with an empty `alt` when a text label sits beside it.

### 5.9 Guards (tests that fail the build)

Each guard follows the existing style: it scans `src/` and names the file and the offending class.

1. `radius-guard.test.ts`: only the radius tokens in §5.3 (plus the named landing exception).
2. `spacing-guard.test.ts`: no half steps other than 0.5, and no arbitrary spacing values.
3. `control-guard.test.ts`:
   - `Button` sizes match §5.4;
   - no `min-h-*`, `h-*`, or padding on elements that `buttonClass` styles from the outside;
   - `role="radiogroup"` and `role="tablist"` appear only in `Segmented.tsx`.
4. `font-guard.test.ts`:
   - no `Inter` or `JetBrains_Mono` import;
   - `fontFamily.sans` equals `fontFamily.mono`;
   - the font files and their licence exist.
5. `shadow-guard.test.ts`: only `shadow-overlay`, only in overlay components.
6. `contrast.test.ts` gains `positive`, `negative`, and the four notice tones in both palettes.
7. `icon-guard.test.ts` gains `TokenIcon`/`PairIcon` sizes and the single indicator-circle size.
8. **`design-doc.test.ts`** (needs a YAML parser: add `yaml` as an exact-pinned dev dependency; nothing is added to the runtime bundle): parses the YAML front matter of `frontend/DESIGN.md` and checks that every token there equals the value in `tokens.ts` and `motion.ts` (colours for both palettes, type scale, radius, spacing steps, control sizes, icon sizes, motion). This keeps the document from drifting from the code. **My call:** the document is hand-written and the test is the check, instead of generating the document from code.

### 5.10 `DESIGN.md` and the other documents

- `frontend/DESIGN.md` follows the reference file's structure:
  - YAML front matter: colours for both themes, typography roles, radius, spacing, control sizes, icon sizes, surfaces, motion, components;
  - Overview (atmosphere, density, personality, principles);
  - Colours;
  - Typography;
  - Layout and spacing;
  - Elevation;
  - Shapes;
  - Components: Button, Segmented, Amount input with token chip and Max, Card, Overview, DataTable, Badge, Notice, Wallet button, TokenIcon / PairIcon;
  - Motion (pointing at U10's values);
  - Responsive;
  - Do's and don'ts;
  - Agent guidelines.

  The content is MezoRoute's values, not DeFi Core's: teal, not green; two themes; Geist Mono; U10's motion; lavender for the Stability Pool.
- `AGENTS.md` → Frontend → "Design system" shrinks to a pointer to `frontend/DESIGN.md`, plus the guard list. Its text must agree with `DESIGN.md`; where U3, U6, U9, or U10 wrote a rule this document changes (Inter, mono for key figures only, `Card`'s heading sizes, `Button` sizes), `AGENTS.md` says what replaced it.
- The U3, U6, U9, and U10 specs are history and stay unchanged.

### 5.11 Phase 1 done means

- Every guard in §5.9 passes, and `npm test` and `npm run build` pass.
- Re-running the audit script on the new build shows:
  - button heights only 44, 36, or 28;
  - radii only from §5.3;
  - one selected style for segmented controls;
  - no visible `th` at weight 700;
  - every app page with one `h1`;
  - at most one primary per page;
  - no hit area under 24 px, or under 44 px below 768 px;
  - no horizontal scroll at 360, 768, 1024, or 1440 px in either theme;
  - 0 console errors.
- The user can merge Phase 1 alone.

## 6. Phase 2: the dapp layout

The approved mockups are in `.superpowers/brainstorm/20407-1793933618/content/` (git-ignored): `dapp-feel.html` shows the layout and `font-options.html` the chosen option D.

### 6.1 Shared building blocks

| Component | What it is |
|---|---|
| `ActionCard` | The flow's one card. Header: `PairIcon` (24) + route name + one figure on the right (this week's APR for the LP route with stake on, the pool's swap fee otherwise; the Stability Pool shows the text "No fee · BTC from liquidations", never a rate: my call, so no page gains a slow archive read and the copy rules hold). Body: the inputs, the overview, and the one primary button. |
| `TokenAmountInput` | A `well` box. Top row: label ("You deposit", "You exit", "You borrow") on the left; "Balance x" and `Max` on the right. Second row: the amount as a large figure (`title` size) and a token chip on the right. When a route offers MUSD and BTC (the LP route outside Borrow & Deploy), the chip opens a small menu that replaces `AssetSwitch`; elsewhere the chip is static. Validation errors appear under the box in `danger` text with an icon. |
| `ReceiveRow` | A `well` box: "You receive" + `xl` figure + its token or pair icon, plus the minimum on a caption line. |
| `Overview` | A bordered `rounded-inset` box of label/value rows (label `sm/500 muted`, value right-aligned): fee, price impact, staking, BTC exposure change, network fee, and Trove change in Borrow & Deploy. It replaces the summary panel's figures. |
| `Details` | A disclosure under the card, closed by default on the amount page. It holds What happens, the "If BTC moves" chart, and the full risk list. The card itself always shows one risk line (the route's main risk plus "Details"). |
| `StatsStrip` | A panel of 3–4 stats (`xs` label, `xl/500` value) split by hairlines. On mobile it becomes a 2 × 2 grid. |
| `DataTable` | §5.6, plus a responsive mode: below 768 px each row becomes a card (label/value pairs, the row action full width). |

### 6.2 Flow pages

- **Amount pages** (LP with MUSD or BTC, Borrow & Deploy, Stability Pool):
  - The page keeps the back link, the Amount → Confirm → Done header, and its `h1`.
  - Content is one centred column, about 480–520 px wide (**builder's call**) and the same width on every page of a flow, so the left edge never moves within a flow. Inside it:
    - the `ActionCard`, with the Deposit | Borrow & Deploy `Segmented` at its top;
    - `TokenAmountInput`;
    - `ReceiveRow`;
    - the stake toggle, as a row with a `Term`;
    - `Overview`;
    - one line of risk;
    - **Review** (primary, `lg`, full width);
    - then `Details` below the card.
  - Slippage moves into a settings popover opened from a "Slippage 1% ⚙" control in the card's top-right, Aerodrome-style. The popover holds the 0.5 / 1 / 2% `Segmented`.
  - `MobileBar` is no longer needed on these pages, because the action is in the card.
- **Confirm pages:** same column. The card shows the reviewed amounts (`Overview`, with minimums), the quote block and countdown, the full risk list, and the `StepList`. The active step's button is the page's one primary.
- **Exit and Withdraw:** the same `ActionCard`. "You exit" uses `TokenAmountInput` in percent mode (the 25 / 50 / 75 / Max presets as a `Segmented` under the field). For an exit that must unstake first, the overview shows that it has an unstake step.
- **Receipt:** a centred card with a status icon, the title ("Deposit confirmed" and so on), the `Overview` of what the events say happened, "View on explorer" (secondary), and one forward primary (View positions).

All of today's behaviour stays: quote refresh and expiry, `BlockedError` notices, balance-shortfall recovery, the gas reserve for BTC, permits and approvals, the `pending` button states, and reload resume. Only where things sit and how they look changes.

### 6.3 Dashboard

Top to bottom:
1. `h1` "Dashboard", with the wallet kind and address as a caption (from today's Next step card).
2. `StatsStrip`: **positions value** (MUSD; exactly `positionTotals`, so the Dashboard and Positions always show the same total; not net of Trove debt, and wallet MUSD is not included), BTC exposure (orange; the existing dashboard figure, which counts staked LP), pending MEZO, and Trove CR. CR shows "No Trove" when there is none, and the at-risk colour from F2 when it applies. These are my calls from the builder check.
3. Two `DataTable`s side by side at 1024 px and up, stacked below that:
   - **Your positions**: MUSD/BTC LP as **one** row (a caption under it splits it, e.g. "0.004154 staked · 0 in wallet"), Stability Pool, and the Trove when open. Columns: position (with `PairIcon`/`TokenIcon`), value, earning, and action (Manage → Positions or the exit flow). When there are no positions, one neutral empty row.
   - **Put your MUSD to work**: the LP route and the Stability Pool. Columns: route, returns (this week's APR with stake, the pool's swap fee otherwise; the Stability Pool shows "BTC from liquidations" as text, never a rate), BTC risk in words ("about half becomes BTC", "stays in MUSD"), and Deposit. At most one Deposit is primary (§5.7): **my call** is that both are `secondary`, because the table compares routes, not one recommendation. A "Compare routes in detail" link goes to the Compare section.
4. BTC exposure (the existing chart panel) and the Trove card, side by side at 1024 px.
5. Compare routes (the existing F6 content, restyled), reached by the link and by `#compare`.
6. On testnet, the Mainnet reference card.

The "Next step" card goes away. Its job (what to do next, with the balances) moves to the stats strip and the "Put your MUSD to work" table, which also shows the wallet's MUSD balance.

### 6.4 Positions

1. `h1` "Your positions".
2. `StatsStrip`: total value at the BTC price, BTC exposure, pending MEZO, and unclaimed pool fees.
3. `DataTable` of positions: **one LP row** (wallet + staked together, as today; a caption splits it into staked and in wallet) and one Stability Pool row. Columns: position, amount, value, earning, action. The LP action is **Exit**, which opens today's combined exit flow unchanged (`exitPlan`, wallet first, unstake when needed). There is no per-row source, so exit logic and calldata do not change. The Stability Pool action is Withdraw. A row expands to show what today's card shows: underlying MUSD and BTC, share of pool, cost basis (which is per position, not per staked or wallet part), and "Exit to MUSD now". These are my calls from the builder check.
4. A **Rewards** card that merges the gauge card and the pool-fees card:
   - pending MEZO with Claim MEZO;
   - unclaimed MUSD and BTC fees with Claim fees;
   - Stake all and Unstake all as secondary actions;
   - the staking copy (fees go to veBTC voters);
   - the neutral empty state (§5.5).
5. The totals chart ("Value in MUSD if BTC moves") as a section.

The gauge-read-failed notices, the Stability Pool's paused state, and history loading keep their current behaviour and copy.

### 6.5 Mobile

- Below 768 px, tables become card lists (§6.1), the stats strip becomes a 2 × 2 grid, and the flow column is full width with the 16 px gutter.
- Every control has a hit area of at least 44 px (§5.4).
- The header stays as it is (U7/U8 rules: one nav link below 640 px, app-owned Connect and account buttons), with the new tokens applied.

### 6.6 Phase 2 done means

- The Phase 1 checks still pass, and the audit script, re-run, shows the same.
- Transaction building is untouched, checked two ways:
  1. Phase 2 changes no file under `src/lib/` that builds, quotes, simulates, or sends (`tx`, `quote`, `trove`, `gauge`, `positions/exit*`, `routes`); the diff against `main` proves it, and any exception needs its own test.
  2. Playwright drives every flow with the mock wallet (EOA and smart account) through amount → confirm → the first wallet request on both builds, against one recorded set of RPC answers. The decoded calldata of each `eth_sendTransaction` and `eth_signTypedData_v4` must match field by field, with only time-derived fields masked: permit and quote deadlines, and Borrow hints.
- Screenshots at 360, 768, 1024, and 1440 px in both themes go to the user for review before the merge.

## 7. QA script

The 6 Nov audit script becomes a repeatable check (kept out of `npm test`, like `quote-accuracy`). It loads every page with the mock wallet at 360, 768, 1024, and 1440 px in both themes, and fails on:
- a button height outside {44, 36, 28};
- a radius outside the tokens;
- more than one visible primary;
- a missing or duplicate `h1`;
- a hit area under the minimum;
- 12 px text in a run longer than about 80 characters;
- horizontal scroll;
- any console error.

**My call:** it lives at `frontend/scripts/live/ui-audit.live.ts` and runs with `npm run ui-audit` against a served `out/`. It uses Playwright through the MCP server or an exact-pinned `playwright` dev dependency, whichever the builder finds lighter (neither is a dependency today).

## 8. Decisions

**Decided by the user (6 Nov 2026, in chat and in the visual companion):**
- Keep the current identity; consolidate into one document and fill the gaps (instead of adopting DeFi Core's look).
- The target feel is a real web3 dapp like Aave and Aerodrome. Both mockups were approved: the compact action card and the Aave-style Dashboard.
- Font: **Geist Mono everywhere** (option D), over keeping Inter with mono figures (A), SF Mono (B; not licensed for the web and different on every OS), and JetBrains Mono (C).
- Icons: unify sizes and add token icons. The user supplies the MUSD, BTC, and MEZO icons.
- No "≈ $" line. Positions moves to a table.
- Scope and order: Phase 1 (foundation) then Phase 2 (layout), each mergeable on its own; the landing keeps its layout.

**My calls** (the user can overrule any of them while reviewing):
- `DESIGN.md` lives in `frontend/` and a parity test keeps it equal to `tokens.ts` (§5.9).
- The radius names, the spacing steps (0.5 is the only half step), and control heights 44/36/28.
- The hit-area approach: 24 px everywhere, 44 px below 768 px, through `::after`, not bigger visuals.
- `positive` gets its own green token; `negative` shares `danger`'s hue.
- One `Segmented` look: a surface chip on a well track. The header nav adopts it.
- Slippage moves into a popover.
- Both Deposit actions on the Dashboard table are secondary.
- Phase 2's flow column is 480–520 px.
- The Next step card is removed.
- The gauge and pool-fees cards become one Rewards card.
- From the builder check: the header network switch becomes a network chip with a menu; inline targets are exempt from the hit-area rule; LP is one row with a combined Exit (no new exit behaviour); the Stability Pool shows text, never a figure, in the card header and the Dashboard table; the Dashboard's first stat is `positionTotals`; the calldata gate masks only time-derived fields.

## 9. Left to the builder

- Geist Mono tracking values, and whether to use the variable font (§5.1).
- The `positive` hex values, within the contrast and distinctness limits (§5.5).
- How the 2 px radii map (§5.3).
- Component file layout inside `src/components/ui/`, and whether `ActionCard` and its parts live in `ui/` or `route/`.
- The QA script's tooling (§7).
- The order of tasks inside each phase. The plan should put the guards first so each later change is checked as it lands.
