# U21 — Icons for common actions, less copy

Short design (the user asked to audit the pages with Playwright, replace text with icons where that is good practice, and apply it without a design round: "làm luôn").

## Intent
Pages read long, most of all on mobile. Cut words where an icon or a disclosure carries the same meaning, without hiding anything a person must read before signing.

## Rules (researched)
- NN/g icon usability: icons alone only for universally known verbs (refresh, copy, external, settings, expand). Navigation and product concepts keep their text labels; an icon beside a label only helps the eye.
- WCAG 4.1.2: an icon-only control carries its name (`aria-label`); the glyph is `aria-hidden`. A tooltip repeats the name on hover and keyboard focus, never as the only label.
- Targets stay ≥ 24 px (44 px below 768 px) through `.hit`; icon sizes follow the text beside them (U10 §8).
- Background reading (how a figure is made, how a mechanism works) moves behind a disclosure; risks stay visible (DESIGN.md: don't hide a risk).

## Approaches
1. Icon-only everywhere possible (nav, row actions, labels): fewest words, fails NN/g for abstract concepts. Rejected.
2. Icons for universal verbs + icon-led rows with short labels + disclosures for background copy (chosen): cuts words where meaning survives.
3. Copy edit only: shorter, but leaves verbs like Refresh as text links. Rejected.

## What changed
- `IconAction` (`components/ui/IconAction.tsx`): inline icon-only button, `aria-label`, `aria-hidden` glyph, CSS tooltip (display none until hover/focus-visible, so it never widens the page), `aria-busy` + spin under `motion-safe`. `RefreshAction` (spins while its promise runs; fixes U20's missing in-flight state) and `CopyAction` (check for `doneFlash`, polite "Copied" live region).
- Refresh text links → `RefreshAction` on Proof and the Trove summary.
- Copy buttons: Proof contract addresses and transaction wallets (was a hover-only `title`), Before you sign's executor (`SignFact.copy`).
- Trove "Change your Trove": one row per action (24 px icon circle, name, one short line, chevron), the whole row the link; the duplicated button labels and the long intro are gone. Mezo app row ends in an external-link icon with "(opens in a new tab)" for screen readers.
- `Disclosure` (`components/ui/Disclosure.tsx`): Compare's method footnote ("How these figures are made"; "Past results, not a forecast." stays visible) and the Trove page's redemption explainer ("How redemptions work"). The Trove flows' aside keeps the explainer open (it sits before signing).
- LP Staking row: one sentence, "≈ X MEZO a week (≈ Y% APR) at this week's rate. Swap fees go to veBTC voters."
- Trove page subtitle: first sentence only (the change card says the rest).

## Not changed (on purpose)
Navigation labels, risk lines and warnings, figure labels, route names, the Confirm quote's Refresh button (a recovery with its own label).
