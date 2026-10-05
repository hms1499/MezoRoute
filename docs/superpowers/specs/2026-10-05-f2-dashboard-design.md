# F2 — Dashboard (design)

Date: 5 Oct 2026 · Task: F2 in `PRODUCT_SPEC.md` §16 · Depends on: F1 (`2026-10-05-f1-app-shell-design.md`) · Branch: `feat/f2-dashboard`

## Goal

Replace F1's "Your wallet" card with the dashboard of spec §9 screen 1 (minus the route comparison, which is F6): once a wallet is connected, the page answers three questions.

1. **What can I do now?** One readiness state (Flow A).
2. **How safe is my Trove?** Collateral, debt, collateral ratio, liquidation price, and borrowing room.
3. **How much BTC am I exposed to, and what happens if BTC drops 10/20/30%?** The exposure panel (FR-15, success criterion 7).

Mainnet works the same way, read-only. F2 sends no transactions.

## Decisions

| Topic | Decision |
|---|---|
| CR safety floor (spec §21) | **160%**, provisional. A borrow never leaves the Trove below 160%, so it survives a 30% BTC drop (110% / 0.7 ≈ 157%). F4 reuses it. |
| "Trove at risk" | A 30% BTC drop would put the collateral ratio below the protocol MCR, so with MCR at 110% the threshold is CR < ~157%. It is derived from the MCR read on chain, not hard-coded. |
| Data layer | One snapshot: every contract read in one multicall at one block, plus separate gas-balance and gas-price queries. Pure modules compute everything from the snapshot. |
| Read failure | All-or-nothing. The only realistic contract failure is `fetchPrice` reverting with "PriceFeed: Oracle is stale."; without a price, neither CR nor exposure means anything, and borrowing is paused anyway. |
| Layout | One column inside F1's 672 px shell, in this order: wrong-network alert → Trove warning → readiness → Trove → exposure (mockup option A). F6 later inserts the amount input and route comparison under readiness. |
| Rounding | Displayed numbers never make a position look safer than it is. CR, collateral, position values, and borrowing room round down; debt and liquidation price round up. |

## Chain facts (verified with `cast` on both networks, 5 Oct 2026)

- `TroveManager.getEntireDebtAndColl(address)` returns `(coll, principal, interest, pendingCollateral, pendingPrincipal, pendingInterest)`. The first three already include the pending values and the interest accrued up to the current block. Debt = `principal + interest` and equals `getTroveDebt`. `principal` includes the 200 MUSD gas compensation.
- `getTroveStatus` returns an enum: 0 nonExistent, 1 active, 2 closedByOwner, 3 closedByLiquidation, 4 closedByRedemption.
- `getTroveMaxBorrowingCapacity(address)` = `coll × price / 110%`, taken at the last collateral change. `BorrowerOperations` rejects any borrow that would push debt above it, so it can bind before the CR floor does. Example, the deployer's Trove (0.045 BTC, 2,062.42 MUSD debt, price 86,436): capacity 2,304.86 MUSD, so about 242 MUSD of room, while the 160% floor alone would allow about 368.
- `PriceFeed.fetchPrice()` is a `view` (18 decimals, MUSD per BTC) and reverts with "PriceFeed: Oracle is stale." when the oracle is stale.
- `MCR()` = 1.1e18 and `CCR()` = 1.5e18 on both networks. `BorrowerOperations.borrowingRate()` = 1e15 (0.1%) on both.
- `StabilityPool.getCompoundedMUSDDeposit(address)` and `getDepositorCollateralGain(address)` exist on both networks.
- Multicall3 (`0xcA11…CA11`) is deployed on both networks, and Passport's chains declare it, so `useReadContracts` sends a single `eth_call`.
- Pool token order differs between networks. Tigris sorts tokens by address, so `token0` is MUSD on testnet and BTC on mainnet.
- Gas price is 146 wei on testnet and about 1.46 gwei on mainnet.
- The user's MetaMask test account has no Trove; the deployer key's account has one (CR 189%).

## 1. Snapshot

New human-readable ABIs (`parseAbi`, like `router.ts`):

- `src/lib/abi/musd.ts`: the TroveManager, PriceFeed, BorrowerOperations, and StabilityPool reads below.
- `src/lib/abi/pool.ts`: `getReserves`, `totalSupply`, `balanceOf`.

`src/lib/dashboard/snapshot.ts` (pure):

```ts
export type Trove = {
  collateral: bigint;           // BTC, 1e18, including pending redistribution
  principal: bigint;            // MUSD, including pending
  interest: bigint;             // MUSD accrued to now, including pending
  debt: bigint;                 // principal + interest
  maxBorrowingCapacity: bigint; // MUSD
};
export type LpPosition = { balance: bigint; totalSupply: bigint; reserveMusd: bigint; reserveBtc: bigint };
export type SpPosition = { deposit: bigint; btcGain: bigint };
export type Protocol = { mcr: bigint; borrowingRate: bigint };
export type DashboardSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  protocol: Protocol;
  trove: Trove | null; // null unless the status is active
  musd: bigint;
  lp: LpPosition;
  sp: SpPosition;
};

export function snapshotContracts(network: NetworkConfig, account: Address); // `as const` list, order below
export function parseSnapshot(network: NetworkConfig, results: SnapshotResults): DashboardSnapshot;
```

The calls, in order:

1. `PriceFeed.fetchPrice()`
2. `TroveManager.MCR()`
3. `BorrowerOperations.borrowingRate()`
4. `TroveManager.getTroveStatus(account)`
5. `TroveManager.getEntireDebtAndColl(account)`
6. `TroveManager.getTroveMaxBorrowingCapacity(account)`
7. `MUSD.balanceOf(account)`
8. `Pool.balanceOf(account)`
9. `Pool.totalSupply()`
10. `Pool.getReserves()`
11. `StabilityPool.getCompoundedMUSDDeposit(account)`
12. `StabilityPool.getDepositorCollateralGain(account)`

`parseSnapshot` maps the reserves through `network.addresses`: the lower address is `token0`.

`src/lib/dashboard/useDashboardSnapshot.ts`:

- `useReadContracts({ contracts, allowFailure: false })`, plus `useBalance` (BTC for gas) and `useGasPrice`. All three use `chainId: network.chainId`, so they read the selected network's RPC whatever chain the wallet is on (as F1's wallet card did).
- Each query has `refetchInterval: 30_000`. A refetch keeps the previous data on screen.
- Returns `{ data?: { snapshot, gasBalance, gasPrice? }, error, refresh }`.
  - A gas-price failure leaves `gasPrice` undefined and is not an error.
  - A snapshot or gas-balance failure is an error.
- F3 and F5 refresh the snapshot after each confirmed transaction (FR-02) by invalidating queries.
- LP tokens staked in a gauge are not counted: only LP held in the wallet.

## 2. Trove module

`src/lib/math.ts`: `WAD = 10n ** 18n` and `isqrt(n: bigint)` (Newton's method; F3's optimal-swap maths reuses it).

`src/lib/trove/constants.ts`:

- `CR_SAFETY_FLOOR = 1_600_000_000_000_000_000n` (160%).
- `AT_RISK_DROP_PERCENT = 30`.

`src/lib/trove/health.ts` (pure, all values 1e18 fixed point):

```ts
export type TroveHealth = "healthy" | "at-risk" | "liquidatable";
export function collateralRatio(trove: Trove, price: bigint): bigint | null; // coll × price / debt, rounded down; null when debt is 0
export function liquidationPrice(trove: Trove, mcr: bigint): bigint | null; // debt × mcr / coll, rounded up; null when coll is 0
export function troveHealth(cr: bigint | null, mcr: bigint): TroveHealth;
export function borrowHeadroom(trove: Trove, price: bigint, protocol: Protocol): bigint;
```

- `troveHealth` returns:
  - `liquidatable` when `cr < mcr`;
  - `at-risk` when `cr × (100 − AT_RISK_DROP_PERCENT) / 100 < mcr`;
  - `healthy` otherwise, including when `cr` is null.
- `borrowHeadroom` is the most MUSD the user can still borrow, rounded down:
  - `limit = min(maxBorrowingCapacity, coll × price / CR_SAFETY_FLOOR)`;
  - result: `0` if `limit ≤ debt`, else `(limit − debt) × WAD / (WAD + borrowingRate)`, because the borrowing fee is added to the debt.
  - F4 checks this against a live borrow before relying on it for Borrow & Deploy.

## 3. Exposure module

`src/lib/exposure/exposure.ts` (pure, spec §12):

```ts
export const DRAWDOWNS = [10, 20, 30] as const;
export type Exposure = {
  troveBtc: bigint;
  lpBtc: bigint;
  lpMusd: bigint;   // lp.balance / totalSupply × reserve (0 when totalSupply is 0)
  spBtcGain: bigint;
  spDeposit: bigint;
  totalBtc: bigint; // troveBtc + lpBtc + spBtcGain
  lpValue: bigint;  // lpMusd + lpBtc × price
  spValue: bigint;  // spDeposit + spBtcGain × price
};
export type Scenario = {
  dropPercent: (typeof DRAWDOWNS)[number];
  price: bigint;                  // price × (100 − d) / 100
  collateralRatio: bigint | null; // coll × price' / debt; null without a Trove or debt
  liquidatable: boolean;          // collateralRatio' < mcr
  lpValue: bigint;                // lpValue × √(1 − d), constant-product approximation, fees ignored
  spValue: bigint;                // spDeposit + spBtcGain × price'; new liquidations not modelled
};
export function exposure(snapshot: DashboardSnapshot): Exposure;
export function drawdownScenarios(snapshot: DashboardSnapshot, exposure: Exposure): Scenario[];
```

`√(1 − d)` is `isqrt((100 − d) × WAD² / 100)`. Every division rounds down, so values never overstate a position.

## 4. Readiness

`src/lib/dashboard/readiness.ts` (pure):

```ts
export const GAS_BUDGET = 3_000_000n;       // gas units: approve + borrowAndEnter, with margin
export const MIN_USABLE_MUSD = 10n ** 18n;  // 1 MUSD
export type ReadinessState = "needs-gas" | "ready" | "can-borrow" | "borrow-in-mezo" | "no-room" | "no-trove";
export type Readiness = { state: ReadinessState; borrowable: bigint; health: TroveHealth | null };
export function readiness(input: {
  snapshot: DashboardSnapshot;
  gasBalance: bigint;
  gasPrice: bigint | undefined;
  walletKind: WalletKind; // the dashboard waits until it is known
}): Readiness;
```

States, the first match wins (`borrowable` = `borrowHeadroom`, or 0 without a Trove):

| State | Condition | Copy | Action |
|---|---|---|---|
| `needs-gas` | `gasBalance < gasPrice × GAS_BUDGET`, or `gasBalance == 0` when the gas price is unknown | "You need BTC on Mezo to pay for transactions." | Get test BTC (testnet) / Open Mezo app (mainnet) |
| `ready` | `musd ≥ MIN_USABLE_MUSD` | "You have X MUSD ready to deploy." When the wallet is an EOA with `borrowable ≥ MIN_USABLE_MUSD`, it adds "You can also borrow up to Y MUSD." | — |
| `can-borrow` | EOA and `borrowable ≥ MIN_USABLE_MUSD` | "Borrow up to Y MUSD against your Trove and deploy it in one transaction." | — |
| `borrow-in-mezo` | smart account or unknown, and `borrowable ≥ MIN_USABLE_MUSD` | "Your Trove can borrow up to Y MUSD. Borrow it in the Mezo app first; Borrow & Deploy needs a standard wallet signature." | Open Mezo app |
| `no-room` | a Trove with `borrowable < MIN_USABLE_MUSD` | "Your Trove has no room to borrow above a 160% collateral ratio. Add collateral in the Mezo app." | Open Mezo app |
| `no-trove` | otherwise | "You need MUSD to start. Open a Trove in the Mezo app to borrow MUSD against BTC." | Open Mezo app |

- `readinessCopy(readiness, snapshot, network)` (pure) returns `{ tag, headline, detail?, action? }`, so the card stays thin and the copy is tested. The `ready` state has no action until F6 adds "Choose route".
- The Trove warning is separate from the state and persistent. It never blocks wallet MUSD (Flow A).
  - **`at-risk`** (amber): "Your Trove is at risk: a 30% BTC drop would make it liquidatable. Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure." Button: **Review exposure**, which scrolls to `#exposure`.
  - **`liquidatable`** (red): "Your Trove is below the 110% minimum and can be liquidated." The 110% comes from the MCR read on chain.

## 5. UI

`src/components/dashboard/`. `Home` renders `Dashboard` once connected, and F1's `WalletCard` is deleted.

- **`Dashboard`**:
  - Calls `useDashboardSnapshot` and `useWalletKind`.
  - First load (snapshot or wallet kind pending): renders skeleton cards.
  - On error: renders one inline card with `decodeError(error, network).message` and **Retry** (`refresh`).
  - Otherwise renders, in order: `WrongNetworkAlert` (F1, when the wallet chain differs), `TroveWarning`, `ReadinessCard`, `TroveCard`, `ExposurePanel`.
- **`ReadinessCard`**:
  - Shows the tag, headline, detail, and action from `readinessCopy`.
  - A wallet line: connector name · `walletKindLabel` · short Mezo account (Bitcoin address in its `title` when present) · BTC for gas.
  - Below it, F1's notes: `walletKindNote`, and on mainnet "Mainnet actions open after launch. Reading only."
- **`TroveCard`**:
  - With a Trove:
    - Collateral (BTC and ≈ MUSD value).
    - Debt, with "includes X MUSD interest" underneath.
    - Collateral ratio with a Healthy / At risk / Liquidatable tag.
    - Liquidation price (MUSD per BTC).
    - Borrowing room ("keeps CR ≥ 160%").
  - Without one: "No open Trove" and **Open Mezo app**.
- **`ExposurePanel`** (`id="exposure"`):
  - BTC price as a header aside.
  - Rows: Trove collateral, MUSD/BTC pool share (BTC, plus the MUSD side and ≈ value), Stability Pool BTC gain (with the deposit), and Total BTC exposure.
  - The one-sentence double-exposure explanation (spec §9 copy rules).
  - The scenario table: columns Now / −10% / −20% / −30%; rows BTC price, Trove CR, LP value, and Stability Pool value. A row is hidden when the user has no such position. A CR cell below MCR is red and reads "Liquidatable".
  - The footnote: "Estimates in MUSD. LP value uses the constant-product approximation (fees ignored). Stability Pool value does not model new liquidations caused by the drop."
  - With no Trove, no LP, and no Stability Pool position, it shows only: "No BTC exposure in a Trove, the LP, or the Stability Pool yet."

Formatting (`src/lib/format.ts`):

- `formatToken` gains a fourth parameter `rounding: "down" | "up" = "down"`.
- New `formatPercent(ratio: bigint, fractionDigits = 1)`, where 1e18 is 100%. It truncates, so 1.509e18 renders as "150.9%".
- Display precision:
  - BTC: 6 decimals.
  - MUSD: 2 decimals.
  - Prices: whole MUSD; the liquidation price rounds up.

## 6. Error decoder changes

- **New kind `price-unavailable`**: "The BTC price feed is temporarily unavailable." · retry. Matched by a new `REVERT_STRINGS` row, `/PriceFeed: Oracle is stale/i`. Spec §13 gains the row.
- **F1 review follow-up 2, closed here**, because F2 is the first feature that shows read errors. For an error without a transaction hash, the RPC-down rule now runs before the generic revert-names rule. A `ContractFunctionExecutionError` → `CallExecutionError` → `HttpRequestError` chain then reads "Mezo testnet is temporarily unavailable." instead of "The transaction reverted." This path occurs because wagmi's `readContracts` falls back to single `readContract` calls when the multicall request itself fails.

## 7. Testing

Vitest, logic only (no component tests, as in F1):

- **`snapshot`:**
  - The contracts list targets `network.addresses`.
  - Status 1 → Trove; 0, 2, 3, 4 → `null`.
  - Reserves: testnet `token0` = MUSD, mainnet `token0` = BTC.
  - Debt = principal + interest.
  - Fixture: the deployer Trove's real values above.
- **`math`:** `isqrt` of 0, 1, perfect squares, non-squares (floor), and 1e36-scale values.
- **`trove/health`:**
  - Fixture CR ≈ 188.6% and the liquidation price.
  - Headroom limited by capacity (fixture ≈ 242 MUSD) and by the floor.
  - Zero headroom when debt ≥ limit.
  - Zero debt → CR null → healthy.
  - Each health boundary.
- **`exposure`**, the spec §14 cases:
  - no Trove;
  - no LP;
  - no Stability Pool deposit;
  - zero debt;
  - plus: LP share maths with `totalSupply` 0, scenario values for each drawdown, and `liquidatable` flags.
- **`readiness`:**
  - Each state.
  - Priority: needs-gas beats ready; ready beats can-borrow.
  - Smart account and unknown → `borrow-in-mezo`.
  - Unknown gas price.
  - `readinessCopy` for each state and network.
- **`format`:** rounding up, `formatPercent`.
- **`decodeError`:**
  - The stale-oracle revert, both from revert data and from text.
  - The RPC-down-without-hash ordering case.
  - A hash-carrying revert still reads "reverted".

Manual QA on a Vercel preview:

- **MetaMask with a testnet Trove** (open one in the Mezo testnet app, after the faucet): the Trove card's numbers match the Mezo app; the exposure panel and scenario table appear; readiness is `ready` or `can-borrow`.
- **MetaMask without a Trove and without MUSD:** `no-trove` with Open Mezo app; the exposure panel shows its empty message.
- **Unisat through Passport:** the wallet line shows "Bitcoin wallet (smart account)"; a Trove with room shows `borrow-in-mezo`.
- **Mainnet:** real reads, the read-only note, and no errors.
- **Wallet on another chain:** the alert shows above the dashboard, and the numbers still load.
- **Phone width (360 px):** no horizontal scroll; the scenario table fits, or scrolls inside its own card.

## Done when

- `cd web && npm test && npm run build` pass.
- The manual QA list passes on a Vercel preview.
- `PRODUCT_SPEC.md` is updated:
  - §21 records the provisional 160% floor and the at-risk rule;
  - §13 gains the price-feed row;
  - §16 records F2 as done.
- `CLAUDE.md` frontend notes describe the snapshot (one multicall, pool token order per network) and the CR constants.

QA passed on 5 Oct 2026 on the preview `mezoroute-1kwmw061f`. Items 1, 2, 4, 5, and 6 ran in Playwright against the local static export with a mock EIP-1193 wallet pointed at real Troves (testnet can-borrow, ready, at-risk, and no-Trove accounts; a mainnet Trove). The numbers were checked against `cast`. The user ran item 3 (Unisat through Passport) and a reload with a real MetaMask. The Playwright run found that every reload dropped the wallet: a discarded first render built a second wagmi config that lost wagmi's reconnect lock. Fixed in `d1fbe3a` (module-level config in `providers.tsx`).

## Out of scope

- Amount input, route comparison, and "Choose route" (F6).
- Positions page, cost basis, and claimable fees (F7).
- Borrow & Deploy (F4).
- LP staked in gauges.
- Recovery Mode handling.
- Wallet BTC in the exposure total (spec §12 counts Trove, LP, and Stability Pool only).
- Mainnet reference card (F8).
