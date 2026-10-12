# F4 — Borrow & Deploy (design)

Date: 12 Oct 2026 · Task: F4 in `PRODUCT_SPEC.md` §16 · Depends on: F3 (`2026-10-05-f3-lp-route-design.md`) · Branch: `feat/f4-borrow-deploy`

## Goal

An EOA user with a Trove borrows MUSD against it and deposits that MUSD into the MUSD/BTC LP in **one `borrowAndEnter` transaction** with two signatures (PRODUCT_SPEC §7 Flow D, §11.4, FR-16). The user approved this design on 12 Oct 2026, including the senior review changes (hints measured, chain-replayed signature test, one headroom source).

## Decisions

| Topic | Decision |
|---|---|
| Placement | The disabled **Borrow & Deploy** toggle on `/route/lp/` is enabled; the URL gains `mode=borrow` (default `deposit`). Preview, confirm, and receipt are F3's, extended. |
| Amount | `musdIn` is the amount borrowed: the contract requires `musdIn == b.amount`, so wallet MUSD is never mixed in. |
| Wallets | EOA only. Smart accounts keep the disabled toggle with "Borrow & Deploy needs a standard wallet signature." (FR-23). |
| Safety floor | Resulting CR ≥ **160%** (`CR_SAFETY_FLOOR`, F2). PRODUCT_SPEC Flow D step 3 ("MCR + 40 pp") is updated to 160%. |
| Headroom | One source: `borrowHeadroom` (fee-aware, `maxBorrowingCapacity`, floor), capped by `maxMusdIn`. Max, the gate, and the dashboard all use it; the gate's CR check uses the same `borrowEffect`. |
| Recovery mode | Borrowing is blocked: MUSD (Liquity) rejects any ICR decrease in recovery mode ("Cannot decrease your Trove's ICR in Recovery Mode"). |
| Hints | Computed at send time: `HintHelpers.getApproxHint(newNICR, 15·⌈√n⌉, seed)` then `SortedTroves.findInsertPosition(newNICR, hint, hint)`. On any hint failure, zero hints (valid, more gas). |
| Gas | The estimate comes from the QA measurement with hints. The live zero-hint borrow (tx `0xdebe…6259`, 2 Oct 2026, 242 Troves) used 2,178,863 gas. |
| Signatures | Stepper: **permit → borrow authorisation → send** (PRODUCT_SPEC §9 screen 3a); the permit is skipped when the allowance covers `musdIn`. Both bind only amount and deadline, so the quote is refreshed before sending without re-signing. |

## Chain facts (12 Oct 2026)

- Borrow authorisation: EIP-712 `WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)`, domain `("BorrowerOperationsSignatures", "1", chainId, BOS)`; nonce from `BOS.getNonce(borrower)`. Verified twice on chain (30 Sep `cast`; 2 Oct tx `0xdebe600d007658ae648a131d68d136d6d8b2b915d96c6f6fcd11480febdc6259`: amount 20 MUSD, borrower = recipient = `0xd74f…2B49`, nonce 2, deadline 1790904394, signature `0x7707dcf3…b81c`).
- Borrowing fee = `amount × borrowingRate / 1e18` (rounded down), minted to the PCV; the debt and principal grow by `amount + fee` (`BorrowerOperations._adjustTrove`).
- The Trove's position in SortedTroves uses the nominal ICR on **principal**: `NICR = coll × 1e20 / principal` (`TroveManager.getNominalICR`).
- `TroveManager.checkRecoveryMode(price)` exists (testnet: false; TCR 300%, CCR 150%); `getEntireSystemColl`, `getEntireSystemDebt`, `CCR`, `getTroveOwnersCount` are plain getters. Testnet has 242 Troves. Mainnet BOS: `0xB57a…df7a`.
- Revert strings to decode: "BorrowerOperationsSignatures: Invalid signature", "Signature expired", "BorrowerOps: An operation that would result in ICR < MCR is not permitted", "…exceeds maxBorrowingCapacity…", "…TCR < CCR…", "Cannot decrease your Trove's ICR in Recovery Mode", "Trove does not exist or is closed".

## 1. Pure modules

- `src/lib/trove/borrow.ts`: `borrowEffect(trove, price, protocol, amount)` → `{ fee, newDebt, newPrincipal, newCr, newNicr }`; `afterBorrowEntry(snapshot, amount, quote)` → the dashboard snapshot with the Trove's new debt and principal, wallet MUSD plus the quote's MUSD refund (the borrowed MUSD goes straight into the pool), and the LP after entry (reuses `afterEntry`).
- `src/lib/trove/borrow-signature.ts`: `borrowTypedData({ network, borrower, amount, nonce, deadline })`; `borrowUsable(signature, nowSeconds)` (same 60 s margin as the permit).
- `src/lib/trove/hints.ts`: `hintTrials(troveCount)`; `findHints(read, input)` with an injected reader, returning zero hints on any failure.
- `src/lib/routes/musd-btc-lp/intent.ts`: `mode: "deposit" | "borrow"`.
- `src/lib/routes/musd-btc-lp/steps.ts`: borrow mode plans `["permit", "borrow", "enter"]` (or `["borrow", "enter"]` when the allowance covers it).
- `src/lib/routes/musd-btc-lp/gate.ts`: borrow mode skips `insufficient-balance` and adds, after `wrong-network`: `smart-account-borrow`, `no-trove`, `recovery-mode`, then after `zero`: `above-headroom` (Max shows the headroom), `cr-floor`.
- `src/lib/routes/musd-btc-lp/params.ts`: `buildBorrow(amount, hints, signature, deadline)`, `encodeBorrowAndEnterCall(borrow, permit, params)`.

## 2. Data

`lpRouteContracts` adds five reads to the same one-block multicall: `BOS.getNonce(account)`, and from `TroveManager`: `getEntireSystemColl()`, `getEntireSystemDebt()`, `CCR()`, `getTroveOwnersCount()`. Recovery mode is `systemColl × price / systemDebt < CCR`, computed locally with the snapshot's price, because `checkRecoveryMode(price)` and `getTCR(price)` need the price as an argument and the price is read in the same multicall. Checked on testnet on 12 Oct 2026: the local TCR equals `getTCR(fetchPrice())` = 3.0036.

## 3. UI

- Route page: `ModeToggle` enabled for EOAs; borrow mode shows "Your Trove after this borrow" (debt → new debt incl. fee, CR → new CR, MCR 110%, floor 160%), the extra risk "Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.", and Max = headroom.
- Confirm page: borrow rows (borrowed, borrowing fee, new debt, new CR) and the three-step stepper ("Sign the borrow authorisation": "Lets MezoRoute borrow exactly this amount from your Trove to your own wallet, inside the deposit transaction. Signing costs no gas.").
- Send: refresh and re-gate; check the borrow signature's deadline and that `BOS.getNonce` still equals the signed nonce (else `BORROW_USED`: "Your borrow authorisation was already used; the MUSD is in your wallet." / Deposit MUSD); compute hints; simulate `borrowAndEnter`; submit; navigate to `/tx/`.
- Receipt: "MUSD borrowed" row when `musdBorrowed > 0`, plus "Your Trove now" read after confirmation.
- Dashboard: the `can-borrow` card shows **Borrow & Deploy** → `/route/lp/?mode=borrow`.

## 4. Testing

**Vitest:** `borrowEffect` (fee rounding, NICR on principal, CR); `afterBorrowEntry`; `borrowTypedData` recovers the 2 Oct signature to `0xd74f…2B49` (chain-replayed); `borrowUsable`; `hintTrials` and `findHints` (success, fallback); gate borrow reasons in order with boundaries (exactly the headroom passes, one wei more blocks; CR exactly 160% passes); steps per mode and allowance; stepper with a `borrow` signature step and expiry; `encodeBorrowAndEnterCall` round-trip; new revert strings; intent `mode` round-trip.

**QA by me:** local export + local signer (as in F3) with the deployer's Trove: borrow & deploy ~5 MUSD; check the `Entered` event (`musdBorrowed` = amount) against the quote, the Trove's new debt = old + amount + fee, allowance 0, executor balances 0; record gas with hints against the 2.18M zero-hint baseline; smart-account toggle disabled; CR-floor and headroom blocks; 360 px.

**QA by the user:** MetaMask on the Vercel preview: Sign permit → Sign borrow → Send → receipt with "MUSD borrowed" and the new Trove.

## Done when

- `npm test && npm run build`, `forge test` pass; the QA above passes with a live `Entered` matching its quote.
- `PRODUCT_SPEC.md`: Flow D step 3 says 160%; §11.4's gas note cites the measured gas with hints; §16 records F4.
- `CLAUDE.md` frontend notes cover the borrow mode, hints, and the chain-replayed signature fixture.

### QA result (12 Oct 2026): passed

- **Agent, local export + local signer:** `borrowAndEnter` of 5 MUSD from the deployer's Trove, tx `0x9d459851de6f25d7370a2ca223dedf0418877f65ae60387d635acce5795f2623`: gas 754,103 with hints (2,178,863 without, 2 Oct); the quote at the previous block matches `Entered` to the wei; principal +5.005 MUSD, BOS nonce +1, allowance 0, executor balances 0. CR-floor block at 300 MUSD, 360 px layouts, and the disabled toggle for a Bitcoin wallet (Unisat mock) checked.
- **User, Vercel preview, MetaMask:** 1 MUSD, tx `0x77ef8ece0b4df29cbe94f81e103014a741f419bbb46dfbda2cde9b2ad3475a51`: permit → borrow authorisation → send; receipt "Borrow & deposit confirmed" with the Trove after it; gas 684,436; principal +1.001 MUSD, nonce +1, allowance 0, executor balances 0.

## Open question (not in F4)

Bitcoin-wallet users cannot use Borrow & Deploy (the Safe cannot sign ECDSA). If a Trove opened through the Mezo app with a Bitcoin wallet is owned by the user's Safe, the Safe could call `BorrowerOperations.withdrawMUSD` directly and then use F3's approve → `enter`: two relayed transactions instead of one. Verify the Trove owner before planning it.

## Out of scope

Opening a Trove; mixing wallet MUSD with borrowed MUSD; LP exit and fee claims (F7); Stability Pool (F5).
