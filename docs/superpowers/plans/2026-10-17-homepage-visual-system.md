# Homepage Visual System Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the disconnected MezoRoute homepage feel like one polished visual system across buttons, borders, surfaces, spacing, typography, and motion.

**Architecture:** Keep the existing dark semantic palette and landing content. Add named landing styles and motion values, preserve the shared button API and its connected-app appearance, then apply the system to the hero/simulator and the lower homepage sections. Finish with the repo's contrast, build, responsive, keyboard, reduced-motion, and landing-to-app QA.

**Tech Stack:** Next.js 14.2.35, React 18.3.1, Tailwind 3.4, TypeScript, CSS, Vitest 5, Playwright QA with the existing keyless mock wallet.

**Spec:** `docs/superpowers/specs/2026-10-17-homepage-visual-system-design.md`

## Global Constraints

- Work only on the disconnected homepage and its landing-aware header/footer presentation.
- Keep teal for actions/LP, lavender for Stability Pool, and orange for BTC exposure.
- Preserve 360 px layout, WCAG AA contrast, visible keyboard focus, reduced-motion behavior, and layout stability.
- No change to quote maths, estimates, fees, caps, risk logic, wallet behavior, or transaction flows.
- No new dependency; keep homepage First Load JS within +5 kB of the 92 kB U2 baseline.
- Preserve the connected app's current shared button behavior.
- Use TDD for pure logic and component style mappings; finish with browser visual QA.

## Review Focus

1. **Shared button styles:** a landing style change could unintentionally alter route or wallet actions; pin alias behavior in `Button.test.ts` and inspect a connected screen in browser QA.
2. **Contrast after surfaces/borders change:** preserve at least 4.5:1 for every text/background pair; pin through `contrast.test.ts`.
3. **Reduced motion:** CSS transitions/animations and count-up values must settle immediately; test `countUpAt` at zero duration and verify browser media emulation.
4. **Responsive layout and long figures:** simulator labels and figures must fit at 360 px; cover that viewport in browser QA with default and invalid/long amount states.
5. **Landing-to-app transition:** shared header/footer controls must remain visually stable when connecting; cover connection and navigation in browser QA.

## File Map

- `web/src/lib/ui/motion.ts`: named duration constants used by landing JS animation calls.
- `web/src/lib/ui/motion.test.ts`: pin motion duration and final-value behavior.
- `web/src/app/globals.css`: landing motion, spacing, and radius variables plus reusable surface/section recipes.
- `web/src/components/ui/Button.tsx`: keep the existing API; align semantic variants and retain landing aliases.
- `web/src/components/ui/Button.test.ts`: pin variant aliases, minimum sizes, and shared button classes.
- `web/src/components/landing/Hero.tsx`, `Simulator.tsx`, `HeroChart.tsx`: apply the shared hero/simulator recipes and named motion values.
- `web/src/components/landing/LiveStrip.tsx`, `RouteLanes.tsx`, `HowItWorks.tsx`, `TrustRow.tsx`, `FinalCta.tsx`, `Landing.tsx`: apply the same section rhythm, borders, route-card treatment, and surface hierarchy.

---

### Task 1: Name and test the landing motion system

**Files:**
- Modify: `web/src/lib/ui/motion.ts`
- Modify: `web/src/lib/ui/motion.test.ts`
- Modify: `web/src/components/landing/hooks.ts`
- Modify: `web/src/components/landing/Simulator.tsx`
- Modify: `web/src/components/landing/LiveStrip.tsx`
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Produce `LANDING_MOTION_MS` in `motion.ts` with exact values: `control: 150`, `card: 200`, `reveal: 600`, `chartDraw: 1200`, `timeline: 1400`, `livePulse: 1800`, `valueFlash: 700`, `simulatorCount: 450`, `liveCount: 1100`.
- CSS uses matching custom properties `--landing-motion-control`, `--landing-motion-card`, `--landing-motion-reveal`, `--landing-motion-chart`, `--landing-motion-timeline`, `--landing-motion-live-pulse`, and `--landing-motion-value-flash`.
- Existing `countUpAt(from, to, elapsedMs, durationMs)` behavior stays unchanged; hooks and live strip consume the named TS values.

- [ ] **Step 1: Write failing motion-token tests.**
  - Add `LANDING_MOTION_MS` assertions for all nine exact values.
  - Keep the existing zero-duration assertion proving reduced motion returns the target immediately.

- [ ] **Step 2: Run the targeted test and confirm it fails.**
  - Run: `cd web && npm test -- src/lib/ui/motion.test.ts`
  - Expected: FAIL because `LANDING_MOTION_MS` is not exported yet.

- [ ] **Step 3: Implement named values and wire callers.**
  - Export the constant from `motion.ts`.
  - Replace the literal `450` in `Simulator` and `1_100` in `LiveStrip` with the named values.
  - Define the matching CSS custom properties and use them for control/card transitions, section reveal, chart draw, timeline fill, live ping, and value flash. Keep the live ping as the only repeating animation.

- [ ] **Step 4: Verify the motion tests.**
  - Run: `cd web && npm test -- src/lib/ui/motion.test.ts`
  - Expected: PASS; existing interpolation and reduced-motion behavior remain unchanged.

- [ ] **Step 5: Commit.**
  - `chore(web): name homepage motion timings`

### Task 2: Standardize landing button roles without changing app behavior

**Files:**
- Modify: `web/src/components/ui/Button.tsx`
- Create: `web/src/components/ui/Button.test.ts`
- Modify: `web/src/components/landing/Hero.tsx`
- Modify: `web/src/components/landing/FinalCta.tsx`
- Modify: `web/src/components/landing/Simulator.tsx`

**Interfaces:**
- Keep `Button`, `ButtonLink`, `buttonClass`, and `ConnectCta` signatures unchanged.
- Landing aliases remain equivalent: `night` maps to `primary`, `nightOutline` to `secondary`, and `nightGhost` to `ghost` for shared dimensions and state behavior. Preserve any dark-surface color treatment needed by the connected header.
- Sizes remain `md` ≥ 44 px and `sm` ≥ 36 px.

- [ ] **Step 1: Add style-mapping contract tests.**
  - Assert primary and `night` share fill/foreground and size classes.
  - Assert secondary and `nightOutline` share outline geometry and size classes while retaining their existing semantic ring color.
  - Assert ghost and `nightGhost` share quiet geometry and size classes.
  - Assert `md` includes `min-h-11` and `sm` includes `min-h-9`.

- [ ] **Step 2: Run the targeted test against the current shared component.**
  - Run: `cd web && npm test -- src/components/ui/Button.test.ts`
  - Expected: PASS; this pins the current semantic color aliases and shared hit-area classes before changing landing call sites.

- [ ] **Step 3: Implement semantic landing usage.**
  - Keep the current public variants backward-compatible.
  - Centralize equivalent base/size/interaction classes so alias variants do not drift.
  - Use primary for the main connect CTA, secondary for the simulator's connect CTA, and ghost for “How it works”.
  - Preserve button label, destinations, focus ring, loading, disabled, and external-link behavior.

- [ ] **Step 4: Run the targeted test.**
  - Run: `cd web && npm test -- src/components/ui/Button.test.ts`
  - Expected: PASS for semantic aliases and minimum hit-area classes.

- [ ] **Step 5: Commit.**
  - `refactor(web): unify landing button variants`

### Task 3: Apply shared surface and spacing recipes to the hero and simulator

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: `web/src/components/landing/Hero.tsx`
- Modify: `web/src/components/landing/Simulator.tsx`
- Modify: `web/src/components/landing/HeroChart.tsx`

**Interfaces:**
- Add landing-only component recipes in `@layer components`: `.landing-panel` for the working surface, `.landing-control` for input/preset geometry, and `.landing-section-title` for consistent section headings.
- Define exact shared geometry values in `:root`: `--landing-space-section: 3.5rem`, `--landing-space-content: 1.5rem`, `--landing-radius-panel: 1rem`, `--landing-radius-control: 0.75rem`, and `--landing-radius-pill: 9999px`.
- Preserve the simulator's amount state, table, notes, loading/error states, accessibility labels, and CTA action.
- Preserve the chart's data, accessible description, route highlight behavior, and `drawIn` behavior.

- [ ] **Step 1: Capture the current hero, simulator, and connected header at 360 px and 1440 px.**
  - Use the existing Playwright browser workflow before editing styles. Keep the screenshots for direct comparison after the CSS changes.

- [ ] **Step 2: Implement the shared recipes.**
  - Define recipes using current semantic colors, the named geometry variables, and a neutral hairline; do not add shadows or a new palette.
  - Apply them consistently to the hero simulator frame, amount input, preset controls, and chart wrapper.
  - Preserve current content widths and section order; adjust only small alignment gaps needed to align hero copy, chart, simulator, and CTA.

- [ ] **Step 3: Review source and run relevant unit checks.**
  - Run: `cd web && npm test -- src/lib/ui/contrast.test.ts src/lib/ui/motion.test.ts src/components/ui/Button.test.ts`
  - Expected: PASS; no product data or math modules change.

- [ ] **Step 4: Commit.**
  - `style(web): align landing hero and simulator surfaces`

### Task 4: Apply the system to the remaining sections and complete visual QA

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: `web/src/components/landing/LiveStrip.tsx`
- Modify: `web/src/components/landing/RouteLanes.tsx`
- Modify: `web/src/components/landing/HowItWorks.tsx`
- Modify: `web/src/components/landing/TrustRow.tsx`
- Modify: `web/src/components/landing/FinalCta.tsx`
- Modify: `web/src/components/landing/Landing.tsx`
- Modify: `docs/STATUS.md`

**Interfaces:**
- All sections use the shared section heading, spacing, divider, and motion vocabulary from Tasks 1 and 3.
- LP and Stability Pool cards retain teal/lavender meanings and existing return-source/risk copy.
- Trust remains factual and keeps the visible unaudited disclosure and explorer link.

- [ ] **Step 1: Apply section recipes.**
  - Add `.landing-section` and `.landing-divider` recipes and align live-strip cell spacing and neutral borders.
  - Give route cards matching geometry and spacing, with only their semantic route accent changing.
  - Align how-it-works markers/divider, trust row icon/title/body, and final CTA to the same rhythm.
  - Preserve all data, text claims, navigation, route highlighting, and trust links.

- [ ] **Step 2: Run the full frontend suite and build.**
  - Run sequentially: `cd web && npm test`, then `npm run build`.
  - Expected: all Vitest tests pass; static export builds and existing postbuild guards pass; homepage First Load JS is at most 97 kB.

- [ ] **Step 3: Serve the export and run browser QA.**
  - Follow `docs/STATUS.md` → QA accounts: serve `web/out` and use Playwright with the keyless mock wallet.
  - At 360, 768, 1024, and 1440 px, verify no horizontal overflow, aligned section edges, button hierarchy, and stable simulator layout for mainnet and testnet selection.
  - Keyboard through every homepage control and verify visible focus. Emulate reduced motion and verify content is final immediately with no decorative animation.
  - Connect the mock wallet; verify the transition to the connected app has no visual flash and the shared header actions retain their prior appearance.

- [ ] **Step 4: Update handover status.**
  - Mark U4 complete, record test/build/QA evidence, and add a session-log entry.
  - Keep the pre-existing `.DS_Store` change out of the commit.

- [ ] **Step 5: Commit.**
  - `feat(web): refine homepage visual system`

## Execution Handoff

The four tasks share CSS recipes and button/motion primitives, so implement them natively in order to avoid overlapping edits; use one independent whole-branch review after all tasks and QA complete.
