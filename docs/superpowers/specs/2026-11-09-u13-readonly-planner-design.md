# U13: Read-only planner and in-place route comparison (design)

Date: 9 Nov 2026 · Branch: `feat/u13-readonly-planner` (on top of the merged U12 branch, `ed79d6d`) · Mockup: `docs/superpowers/mockups/2026-11-09-u13-planner.html` ([desktop](../mockups/u13-planner-desktop.png) · [mobile](../mockups/u13-planner-mobile.png))

## Why

The LP planner is the app's front door, and today it closes it. `/route/lp/` is wrapped in `RequireWallet`, so a first-time visitor sees a `ConnectCard` instead of the pool, the quote, the fee, or the risks. The only way to learn what a deposit would do is to connect a wallet first. The route comparison that answers "LP or Stability Pool?" sits on the Dashboard behind the same wall, so the two routes cannot be compared before handing over an address.

U12 made the connected page state what the user is about to do and what they get. U13 removes the wall: the planner quotes the same entry before a wallet connects, and puts the Stability Pool comparison beside the amount. The public chain data is enough for both; no account data is needed.

The approved mockup is the visual reference, not a pixel contract. Its numbers are illustrative.

## Goals

- A visitor with no wallet sees the live pool quote, the minimum LP, this week's rate, the overview, and the risks for a typed amount.
- The page's primary action is `Connect to review`, opening the wallet modal at that point. The typed intent (`amount`, `slippage`, `stake`, `asset`) survives the connection and a reload.
- The LP and Stability Pool routes for the same MUSD amount are compared on the planner, from the same block, without a second snapshot or a trip to another page.
- No account-scoped read happens before connection: the planner reads the chain with the zero address, and shows no zero as the visitor's balance.
- After connection, every check and recovery U12 established behaves exactly as it does today.

## Non-goals

- A planner for the Stability Pool, Borrow & Deploy, or the Trove pages. `/route/stability-pool/` keeps its current wallet gate.
- Letting a wallet-less visitor borrow. `Borrow & Deploy` needs a Trove and a signature; its tab stays disabled until a wallet with a Trove connects.
- The 30-day backtest on the planner. F6's "Compare routes" card on the Dashboard remains the place for history.
- Changing `entryPreview`, the gate, the quote maths, transaction payloads, or any contract.
- A new APR model, an annualised Stability Pool figure, or projected liquidation income.
- Merging the Dashboard's snapshots, a Trove hub, or a shared amount formatter.
- Reading a wallet address from local storage or any other source before the user connects.

## Anti-goals

The design fails, even if it builds, if:

- the Stability Pool shows a rate, an APR, or the word "earn";
- a quote appears without saying rates are this week's and the software is unaudited;
- a visitor sees `Balance 0` and believes it is their balance;
- the page has two accent buttons (Connect plus Review, or Connect plus a recovery);
- a pre-connection "insufficient balance" notice appears for an amount the visitor has not tried to fund;
- connecting loses the amount, or a reload of the planner loses the URL intent;
- the planner builds calldata or asks for a signature before the user reviews.

## Zero-address reads (verified 9 Nov 2026, Mezo testnet)

The planner reuses the existing snapshot with `account = zeroAddress`. Every account-scoped read the LP route makes was called on testnet and none reverted:

| Call | Result |
|---|---|
| `TroveManager.getTroveStatus(0x0)` | `0` (non-existent) |
| `TroveManager.getEntireDebtAndColl(0x0)` | six zeroes |
| `TroveManager.getTroveMaxBorrowingCapacity(0x0)` | `0` |
| `StabilityPool.getCompoundedMUSDDeposit(0x0)` | `0` |
| `StabilityPool.getDepositorCollateralGain(0x0)` | `0` |
| `MUSD.balanceOf(0x0)` / `allowance(0x0, executor)` / `nonces(0x0)` | `0` |
| `BorrowerOperationsSignatures.getNonce(0x0)` | `0` |
| `Pool.balanceOf(0x0)` | `0` |
| `Gauge.balanceOf(0x0)` / `earned(0x0)` | `0` |

Addresses used: testnet TroveManager `0xE47c…6bb0`, StabilityPool `0x1CCA…680e`, MUSD `0x1189…c503`, Pool `0xd16A…6AA9`, Gauge `0x72D8…Cd2c`, executor `0x1281…6288`, BorrowerOperationsSignatures `0xD757…639e`. The commands were `cast call <address> "<signature>" 0x0000000000000000000000000000000000000000 --rpc-url https://rpc.test.mezo.org`.

Mainnet uses the same Liquity/Tigris implementations and getters. The QA pass loads the mainnet planner read-only and records the block; if any read reverts there, the fallback is a planner-only snapshot that drops account-scoped calls (see Risks).

This is why no separate "planner snapshot" type is needed: `parseLpRouteSnapshot` already turns status `0` into `trove: null` and every balance into `0n`.

## UX

### Exploring (no wallet)

The page keeps U12's header and one action card. There is no `ConnectCard`.

- **Amount.** Editable. The quote, `Minimum received`, staking toggle, the four overview rows, the risk line, and Details are exactly the connected page's, computed from the zero-address snapshot.
- **Balance line.** Reads `Connect to see balance` instead of `Balance 0`. `Max` is visible but natively disabled.
- **Borrow & Deploy.** Disabled, with the note `Connect a wallet to borrow against your Trove.` If a URL says `mode=borrow`, the page displays Deposit until a wallet connects; the URL keeps `mode=borrow` so the choice applies after connection.
- **Primary.** One accent button, `Connect to review`, opens RainbowKit's connect modal. Cancelling leaves the planner untouched. After connection it becomes U12's Review or recovery action.
- **Notices.** The 2% slippage warning still appears. `BlockNotice`, balance recoveries, and `WrongNetworkAlert` do not: they describe a wallet the visitor has not connected. `entryPreview` still computes a block; the page ignores it while unconnected.
- **Before you sign.** Visible: executor, on-chain fee, entry cap, audit status, and the block the figures were read at.
- **Compare.** Visible for MUSD deposits; details below.

### Connected

The page is U12's page. The only differences are the snapshot's account (the connected address) and that the gate-derived UI returns. A reconnect on load keeps the existing `LoadingCard`: the planner must not flash `Connect to review` at a returning wallet. A wallet on another chain sees `WrongNetworkAlert` as today.

### Comparison card

Title `Compare with the Stability Pool`, with the amount as a badge. It reads the same `LpRouteSnapshot` as the quote, so both sides share one block.

**LP section**

- `You get`: `Swap fees + MEZO` when staking is on and the gauge is open; otherwise `Swap fees`.
- `This week`: this week's APR when a MEZO price exists; otherwise the MEZO per week; between weeks, `New week's rate not set yet`; with staking off or the gauge unavailable, `Pool fee 0.3%`.
- `Held`: `MUSD/BTC LP`, sub-line `About half your MUSD becomes BTC`.

**Stability Pool section**

- `You get`: `BTC from liquidations`.
- `This week`: `Variable · paid in bursts`.
- `Held`: `MUSD until a liquidation`.
- No percentage, no APR, no projection. Footer: `No annualised rate. Withdrawals pause while any Trove is below MCR.` The card never annualises the pool.

**Amount.** The typed MUSD amount. When the field is empty, the card uses `defaultCompareAmount(0n, network.entryCap)` — the 1,000 MUSD example — and says `Example amount`. When the text is invalid, the card says `Enter a valid amount to compare.` and offers no Stability Pool link. The card is not shown in Borrow & Deploy mode or for `asset=btc`; the BTC entry shows one line: `The Stability Pool takes MUSD; switch the deposit to MUSD to compare.`

**Action.** One secondary `Deposit to Stability Pool instead` → `/route/stability-pool/${spDepositQuery(amountText)}`. The card's links never become a second primary.

### Layout

`FlowColumn` gains an optional `aside`:

- Below `lg`, the existing 520 px column is unchanged; the aside follows the flow's children (after the closed Details summary).
- From `lg`, the column becomes 876 px: a 520 px left column (header and action card) and a 340 px aside, `items-start`, 16 px gap. The header stays 520 px wide and left-aligned with the card. The aside does not stick.
- Every other flow page passes no aside and keeps its current 520 px centred column.

The aside holds the comparison card and, below it, `Before you sign`. On mobile both follow the action card and Details.

## Architecture

### Page and snapshot

**`src/components/lp/LpRoutePage.tsx`**

- Remove `RequireWallet` from the default export.
- `useAccount()` gives `address` and `status`. `status === "reconnecting"` renders the current `LoadingCard` (no planner flash). Otherwise the page renders `<LpRouteForm account={address} executor={…} />`; `account` may be `undefined`.
- `connected = account !== undefined`.
- The network/executor check (`NoExecutorCard`) stays.
- `preview` is computed with `intent` whose mode is `deposit` while unconnected (`displayMode`). `asset` is preserved.
- `const block = connected ? preview.block : null`; `recoveries` are computed only when `connected`; `BlockNotice` receives `rest` only when connected.
- One primary action: when unconnected, `{ label: "Connect to review", node: <ConnectCta label="Connect to review" variant="primary" className="w-full" arrow /> }`; otherwise U12's `splitPrimary` result or the Review link.
- `WrongNetworkAlert` renders only when `connected && chainId !== network.chainId`.
- `ModeToggle` gets `connected`; `lpAmountField` gets `connected`; the balance note and gas-reserve note are omitted while unconnected.
- The comparison card and `Before you sign` are passed as `FlowColumn`'s `aside`.

**`src/lib/routes/musd-btc-lp/useLpRouteSnapshot.ts`**

```ts
export function useLpRouteSnapshot(
  account: Address | undefined,
  executor: Address,
): { data: LpRouteData | undefined; error: Error | null; refresh: () => Promise<LpRouteData> };
```

- `lpRouteContracts(network, executor, account ?? zeroAddress)`.
- `useBalance({ address: account, chainId, query: { enabled: account !== undefined, refetchInterval: QUOTE_REFRESH_MS } })`.
- Ready when the multicall is ready and (`account === undefined` or the balance is ready); a planner's `gasBalance` is `0n`.
- `refresh` behaves as today. The gas price is still read, so the network fee and the BTC Max reserve stay correct after connection.

**No change** to `LpRouteSnapshot`, `parseLpRouteSnapshot`, `entryPreview`, `entryBlock`, or any quote maths.

### Amount field

**`src/lib/flow/lp-entry.ts`**

```ts
export type LpAmountField = {
  token: Token;
  tokens?: Token[];
  label: string;
  balanceLabel: string;
  balance: bigint | null; // null before a wallet connects
  max: bigint | null;
};

export function lpAmountField(input: {
  preview: EntryPreview;
  mode: EntryMode;
  asset: EntryAsset;
  walletMusd: bigint;
  connected?: boolean; // default true
}): LpAmountField;
```

- `connected === false` → `balance: null`, `max: null`, for MUSD and BTC.
- Connected output is unchanged.

**`src/components/flow/TokenAmountInput.tsx`**

- `balance: bigint | null`.
- When `null`: render `Connect to see balance` in the balance slot (no number, no `0`) and keep `Max` disabled.
- The accessible description still names the balance line; no new live region.

**`src/components/lp/ModeToggle.tsx`**

- New optional `connected?: boolean` (default true).
- `connected === false` → Borrow & Deploy disabled with `Connect a wallet to borrow against your Trove.`, regardless of `hasTrove`.
- Connected behaviour is U7/U12's, including the smart-account reason and the existing-Trove rule.

**`src/components/lp/LpEntryCard.tsx`**

- `action` gains `node?: ReactNode`; when present it renders in place of the `Button`/`ButtonLink` and owns its label and arrow. The page uses it for `ConnectCta`.
- All other action rendering is unchanged (U12: disabled inert link, external no arrow, one primary).

### Comparison

**`src/lib/flow/planner-comparison.ts`** (new, pure)

```ts
export type PlannerCompareRow = { label: string; value: string; sub?: string };
export type PlannerCompare = { lp: PlannerCompareRow[]; sp: PlannerCompareRow[] };
export const PLANNER_COMPARE_NOTE =
  "No annualised rate. Withdrawals pause while any Trove is below MCR.";

export function plannerComparisonRows(input: {
  stake: { on: boolean; availability: StakeAvailability };
  apr: bigint | null;
  weekly: bigint | null;
  poolFeeBps: bigint;
}): PlannerCompare;
```

- Uses `formatPercent` / `formatToken` / `formatBps`; no new maths. `apr` and `weekly` are the page's existing `emissionsApr` / `mezoPerWeek` results, so the planner cannot disagree with the header.
- The Stability Pool rows are constants; the only dynamic SP fact is the amount, which lives in the badge and the link.
- Tests pin: SP values never contain `%`; LP says this week's rate only; between weeks has no number; stake off says `Swap fees`; the note says "No annualised rate".

**`src/components/lp/PlannerComparison.tsx`** (new, presentational)

Props:

```ts
{
  amountText: string;
  amountMusd: bigint;
  example: boolean;
  state: { kind: "rows"; rows: PlannerCompare } |
         { kind: "message"; text: string };
  spHref: string | null;
}
```

- `Card` with title `Compare with the Stability Pool` and the amount badge (`formatToken(amountMusd, 18, 2)` MUSD).
- Two sections with a coloured dot (teal for LP, lavender for SP — the existing `accent` / `sp` tokens), a `<dl>` of rows, and the footer note.
- `Example amount` caption when `example`.
- Secondary `ButtonLink` to `spHref`; no link in the message state.
- `Card title` is the card's `h2`; section names are `h3` (or `<p>` with a heading class if a third level is not used elsewhere). Put `Term id="stabilityPool"` on the card title: this is the page's first mention (U8), and the term must not sit inside the link or button.

**`src/components/lp/BeforeYouSign.tsx`** (new, presentational)

Props: `{ network: NetworkConfig; feeBps: bigint; capMusd: bigint; blockNumber: bigint }`.

Rows: `Executor` (`shortAddress`, linked to `explorerAddressUrl`), `MezoRoute fee` (`formatBps`), `Entry cap` (`formatToken(capMusd, 18, 0) MUSD`), `Audit` (`Unaudited software`, link to `REPOSITORY`), `Reads` (`Block ${blockNumber}`). `Card` title `Before you sign`, `text-sm` rows. The fee is the chain's value, not the pinned config.

### Page composition

```tsx
<FlowColumn header={…} aside={
  <>
    {displayMode === "deposit" ? <PlannerComparison … /> : null}
    <BeforeYouSign … />
  </>
}>
  {…LpEntryCard / Details…}
</FlowColumn>
```

- The comparison's amount: `intent.musdIn` when valid; otherwise the `defaultCompareAmount(0n, network.entryCap)` example for an empty field; otherwise a message state.
- `compareRoutes({ snapshot: dashboard, amount, executorFeeBps: snapshot.executorFeeBps, mezoPrice })`; the zero-address snapshot is enough. `overBalance` is ignored while unconnected (the wallet balance is unknown).
- `asset=btc` and borrow mode show the message state or no card, not a converted comparison.

### Styling

- No new colour, radius, shadow, spacing step, or font. `Card`, `ButtonLink` (secondary), `Badge`-style amount chip (existing classes), and the `accent`/`sp` tokens.
- One accent button per view: Connect/Review/recovery. The SP link is secondary.
- Full sentences are `text-sm`; captions are `text-xs`. One `h1` (U12's `Add liquidity`).
- No animation beyond the existing `Settle`; the aside settles with the page, not separately.
- `Term` on the first `Stability Pool` mention, never inside the CTA.

## Edge cases

| Case | Behaviour |
|---|---|
| Snapshot fails | `LoadError` with Retry, as today; the rest of the page does not render a fake quote |
| No executor on the network | `NoExecutorCard`, as today |
| Gauge read fails | `gauge: null` + `gaugeReadFailed`; staking off; comparison shows `Swap fees`; Positions/claim unaffected |
| Gauge alive but between weeks | Staking still on; header and comparison say the new week's rate is not set |
| No MEZO price (testnet) | No APR; MEZO per week when staking is on; comparison says the same |
| Empty amount | No receive row/overview; comparison uses the 1,000 example with `Example amount`; Connect still works |
| Invalid amount text | Comparison message; no SP link; Connect still opens the modal |
| Amount above cap/balance | Planner quotes it (no gate); Before you sign shows the cap; after connection the existing gate and U12 recovery take over |
| `asset=btc` | Balance/Max hidden; comparison replaced by the MUSD-only message; BTC quote and stake still work |
| `mode=borrow` in the URL, no wallet | Display Deposit; URL keeps the mode; after connection Borrow & Deploy applies if the Trove allows it |
| Wallet connect cancelled | Planner unchanged; quote keeps refreshing every 15 s |
| Wallet reconnecting on load | Existing `LoadingCard`; no Connect flash |
| Wrong network connected | `WrongNetworkAlert`; reads still target the selected network |
| Smart account connected | Same as today: approvals instead of permits, Borrow & Deploy disabled |
| Mainnet, no wallet | Planner works; Before you sign shows the mainnet executor, fee, cap, block |
| Quote older than 60 s | Page refreshes every 15 s; the age gate still applies only after connection/review |

## Copy rules

- `Connect to review`, `Connect to see balance`, `Connect a wallet to borrow against your Trove.`
- `At this week's rate`, `Swap fees + MEZO`, `Variable · paid in bursts`, `No annualised rate…`
- Never `earn`, `guaranteed`, `risk-free`, `≈ $`, or an APR for the Stability Pool.
- `Unaudited software` stays visible before connection.
- The comparison's SP footer is the same claim as F6's; do not invent a second wording.

## Verification

### Unit and component (Vitest)

- `lpAmountField`: unconnected returns `balance: null`, `max: null` for MUSD and BTC; connected output is unchanged.
- `TokenAmountInput`: `balance={null}` renders `Connect to see balance`, no `Balance 0`, and `Max` disabled.
- `ModeToggle`: unconnected note; connected EVM/Trove/smart-account cases unchanged.
- `LpEntryCard`: `action.node` renders the CTA and keeps one `bg-accent`.
- `FlowColumn`: with `aside` contains the 876/520/340 layout and the aside; without it the classes are unchanged.
- `plannerComparisonRows`: SP rows have no `%`; LP this-week variants; between weeks; stake off; no MEZO price.
- `PlannerComparison`: example badge, message state, SP href, `Term` outside the link, one secondary action.
- `BeforeYouSign`: short address, fee, cap, block, audit link.

### Browser QA (Playwright, keyless mock EIP-1193 wallet, served `out/`)

1. `/route/lp/?amount=1000&slippage=1` with no wallet at 360/768/1440, light and dark: no `ConnectCard`; quote and minimum visible; no `Balance 0`; `Max` disabled; one accent CTA; no horizontal scroll; 0 console errors.
2. The multicall for the planner names `0x0000000000000000000000000000000000000000` in account-scoped calls; no wallet balance request is made.
3. `Connect to review` opens the wallet modal; cancelling keeps the page and amount.
4. Connect the funded mock account: amount, slippage, and stake are unchanged; the CTA becomes Review (or U12's recovery for a no-MUSD account); the quote updates with the account snapshot.
5. Reload a connected planner with `?amount=…`: the amount survives; reconnect shows the loading card first.
6. `Deposit to Stability Pool instead` goes to `/route/stability-pool/?amount=…`; the amount is prefilled.
7. `asset=btc`: no balance/Max; the comparison shows the MUSD-only message; the BTC quote still renders.
8. Mainnet, no wallet: figures render, Before you sign names the mainnet executor, no console errors.
9. Existing `/route/stability-pool/`, `/route/lp/confirm/`, `/positions/` are unchanged apart from the now-optional `FlowColumn` prop.

### Build and safety

- `cd frontend && npm test && npm run build` passes; record the Vitest count and First Load JS.
- No file under `src/lib/{tx,quote}` changes, and no contract changes; `calldata-parity` is not required by construction. If any route/tx file is touched unexpectedly, run it.
- No new dependency.

## Acceptance criteria

- A visitor with no wallet can type an amount and see the live LP quote, minimum, this week's rate, overview, and risks.
- The page never shows a zero balance, a gate notice, or a network warning before a wallet connects.
- Exactly one accent CTA; it opens the wallet modal; the intent survives connect and reload.
- The comparison card shows both routes for the same amount from one block, with no Stability Pool rate.
- The SP link prefills the amount on the SP deposit page.
- After connection, U12's Review/recovery behaviour is unchanged.
- All unit tests and the build pass; the browser QA matrix has no console errors or horizontal scroll.
- No transaction payload, contract, or quote maths changed.

## Risks

- **Mainnet zero-address reads were not called.** They share the testnet implementation, but the QA step loads the mainnet planner read-only and records the block. If a read reverts, the fallback is a planner-only snapshot: `price`, pool reserves/supply/fee, executor fee/cap, gauge, system coll/debt/CCR, block, and gas price, with `trove: null`, all balances `0n`, and allowances/nonces omitted. `entryPreview` would then be replaced by a quote-only preview in this page.
- **A wider FlowColumn could regress other flows.** The prop is optional and the no-aside branch keeps today's classes; the QA matrix covers the SP route and Confirm.
- **The example amount may look like the visitor's amount.** It is labelled `Example amount` and never written to the URL until typed.
- **Comparison copy could imply a Stability Pool yield.** The pure helper and component tests pin "no %" in SP rows and the footer sentence.
- **The chain fee may differ from the pinned fee.** Before you sign shows the chain value; the send gate still blocks a mismatch after connection. No new handling in U13.

## Out of scope (recorded so no task drifts)

- SP planner, borrow planner, Trove hub, CR meter, pool-share copy.
- 30-day backtest in the aside; it stays on the Dashboard.
- One-block Dashboard snapshots; the planner uses its own LP snapshot.
- A shared amount formatter, or changes to `TokenAmountInput`'s token menu.
- Testnet/mainnet fee or cap changes, contract deployment, or transaction building.
