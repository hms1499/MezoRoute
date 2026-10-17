# U4 — Homepage visual system refinement

**Date:** 17 Oct 2026 · **Status:** Written for user review · **Follows:** U2 landing redesign, U3 shared identity
**Reference:** Aave homepage (`https://aave.com/`), used for interaction and craft principles only

## 1. Intent

Refine MezoRoute's homepage so its buttons, borders, surfaces, spacing, typography, and motion feel like one deliberate system. Aave is the quality reference for clarity and finish; MezoRoute keeps its own dark route-comparison identity, BTC-risk chart, live simulator, truthful risk presentation, and Mezo-specific content.

The audience is a prospective Mezo user who has not connected a wallet. The homepage should let them understand the product, try the comparison, see why they can trust the information, and know the next action without being overwhelmed.

## 2. Scope

**In scope:** the disconnected homepage (`/`) and its landing-only presentation, including the landing-aware header/footer surfaces and the existing hero, simulator, route lanes, how-it-works, trust row, and final CTA.

**Out of scope:** connected dashboard and transaction flows, quote and simulation maths, on-chain behaviour, route copy changes that alter product claims, network configuration, new marketing metrics, and new dependencies.

The app's existing dark palette and semantic colour meanings remain binding: teal for actions/LP, lavender for Stability Pool, orange for BTC exposure. Existing 360 px layout constraints, WCAG AA contrast checks, and reduced-motion support remain in force.

## 3. Design principles

1. **One visual grammar:** the same radius, spacing rhythm, border treatment, button states, and motion timing recur across the homepage.
2. **Clear hierarchy:** one primary action per section; supporting actions and live data remain visually quieter.
3. **Product before decoration:** the live route simulator and "If BTC moves" chart remain the signature. Motion and borders help explain the product rather than compete with it.
4. **Trust through verifiable facts:** retain the visible unaudited disclosure and existing explorer/source links. Do not borrow Aave's scale claims, partner logos, yield claims, or wording.
5. **Stable and accessible:** preserve keyboard navigation, visible focus, contrast, reduced motion, responsive behavior, and layout stability.

## 4. Visual system

### 4.1 Tokens and surfaces

Keep the current dark palette as the source of truth. Review landing styles for repeated one-off values and route them through a small set of semantic tokens or shared classes for:

- page canvas and subtle hero glow;
- working panel surface and inset/well surface;
- standard and quiet hairline borders;
- standard, compact, and display spacing;
- small, panel, and pill radii;
- interaction, reveal, and chart motion timing/easing.

Do not introduce another palette or change the meaning of existing colours. Panels use a restrained hairline and surface contrast, with no new drop shadows. Route emphasis uses the existing route colours; separators and secondary edges stay neutral. Keep current content widths and section order unless a small alignment correction is required for consistency.

### 4.2 Buttons and links

Use the existing `Button`, `ButtonLink`, and `ConnectCta` components rather than adding homepage-only button markup. Give each section a clear hierarchy:

- **Primary:** filled teal, reserved for the main action.
- **Secondary:** outlined, for the supporting action.
- **Quiet:** text/ghost treatment for in-page navigation and low-priority links.

Standardize size, radius, icon spacing, and hover/pressed/disabled states across the landing. Keep the 44 px minimum height for primary actions and at least 36 px for other controls. Focus remains a visible 2 px ring with adequate offset. Any changes to shared button styles must preserve their current use in the connected app; the landing work must not cause route or wallet actions to change appearance unexpectedly.

### 4.3 Borders and cards

Use one consistent border rule for panels and cards, with a quieter rule for section dividers and a clear accent only for selected/route-specific content. Avoid stacking multiple outlines around the same object. Keep the simulator visually prominent as the main working panel; trust and explanatory sections should read lighter and calmer.

### 4.4 Motion

Keep the current BTC-risk chart draw and live simulator count-up as the signature motions. Consolidate durations and easing into named motion tokens, then apply a small motion vocabulary:

- quick feedback for hover, press, and focus-related transitions;
- one-time entrance/reveal for the hero and below-fold sections;
- one-time route drawing and value updates for product feedback.

Only the live-data indicator may loop continuously. Motion must not change figures, move surrounding layout, or delay interaction. Under `prefers-reduced-motion: reduce`, show final content immediately and disable decorative movement.

### 4.5 Type and spacing

Preserve Inter for prose and labels, JetBrains Mono for key figures, and the current content order. Align headings, card edges, controls, and section gaps to a consistent spacing rhythm. Keep prose labels in plain language; do not use monospace styling as decoration or add marketing copy that changes financial meaning.

## 5. Page application

- **Hero:** preserve the concise promise, clear primary CTA, BTC-risk chart, and simulator. Align the hero copy, chart, simulator frame, and CTA controls to the shared rhythm.
- **Simulator:** remain the most prominent panel. Make the input, preset controls, table, notes, and connect CTA feel like one component with consistent borders and interaction states.
- **Route lanes:** use matching card structure and spacing while retaining teal/lavender semantics and their distinct risk copy.
- **How it works:** align step markers and dividers to the shared border/motion language; keep the sequence easy to scan.
- **Trust row:** retain the explicit unaudited warning and explorer link; keep icon, title, and body alignment consistent.
- **Final CTA:** reuse the primary/secondary button rules and the page's spacing scale.
- **Header/footer:** maintain the shared landing/app identity and ensure the connected-app transition has no visual flash or inconsistent control treatment.

## 6. Acceptance criteria

- The homepage reads as one visual system across desktop and mobile, with consistent buttons, borders, surfaces, spacing, and motion.
- The existing BTC-risk chart and live simulator remain the visual/product signature.
- No horizontal overflow at 360 px; layout remains stable as live data arrives and figures update.
- All text/background pairs continue to meet WCAG AA contrast; all controls remain keyboard reachable with visible focus.
- Reduced-motion preference removes decorative animation and reveals final values immediately.
- No changes to quotes, estimated returns, fees, caps, risk logic, wallet behavior, or transaction flows.
- No new dependency; homepage bundle remains within the existing +5 kB budget from the U2 baseline.
- Visual QA covers the homepage at 360, 768, 1024, and 1440 px, both with default and reduced motion, plus the landing-to-connected-app transition.

## 7. Implementation areas

Expected landing-only touch points include `web/src/app/globals.css`, `web/src/lib/ui/tokens.ts`, `web/src/components/ui/Button.tsx`, and the existing modules under `web/src/components/landing/`. Final file selection belongs in the implementation plan after this spec is approved.

Do not start implementation until this spec is reviewed and approved, then create and review a separate implementation plan.
