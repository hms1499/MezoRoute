# U19: Proof page and the sMUSD comparison

Status: approved in chat 13 Nov 2026 (Proof mockup v3; sMUSD "level A"). Branch: `feat/u19-proof-smusd`.
Mockups (git-ignored): `.superpowers/brainstorm/89663-1794534797/content/proof-page-v3.html`, and section D of `landing-full-v4.html` for the Compare column (only that section; the landing changes in that file were rejected).

## 1. Why

Two gaps judges and users keep hitting:

1. **Nothing in the app lets a visitor check our claims.** Wave 1 reviews asked for explorer verification and outside users (48 and 42 mentions). Surety, a top Wave 1 payout, answers this with a proof page that lists every contract and transaction. MezoRoute has the evidence (3 verified, immutable contracts; 25 mainnet transactions; two outside wallets since 12 Nov) but it lives in `PRODUCT_SPEC.md` §20 and the explorer.
2. **Compare leaves out the second-largest pile of MUSD.** The MUSD Savings Vault (sMUSD) is Mezo's own savings product. A "router" that compares only the LP and the Stability Pool looks incomplete, and on 13 Nov the vault's staked MEZO rate is far above the LP's. Showing it may make our LP route look worse; it is the truth, so we show it.

## 2. Goals, non-goals, anti-goals

Goals
- A `/proof/` page, reachable from a **Proof** item in the header nav, that lists MezoRoute's contracts and every call to them on mainnet and testnet, read live, no wallet needed.
- sMUSD as a read-only third option in `/compare/`, in the two planners' comparison aside, and in the "Mainnet today" card.

Non-goals
- No deposit route into sMUSD (no executor, no direct deposit flow, no Positions row). The column's action opens the Mezo app.
- No landing change. The user rejected the landing tabs, How it works rework, and landing Proof section (v1–v4): the landing stays as it is.
- No stats strip on `/proof/`, no "holds now" balances, no "What the code guarantees" section (all removed by the user in review).
- No pinned or featured transactions on the testnet tab.
- No new contract.

Anti-goals (a build that does these has failed even if it works)
- A transaction list that misses Bitcoin-wallet users. Their calls are relayed through an OrangeKit Safe, so our contracts are reached by an internal call that the explorer's transaction list for our address does not show.
- Calling a team wallet "outside", or an outside wallet "team".
- Annualising or projecting sMUSD MEZO beyond "this week's rate", or implying a staker also earns the vault's MUSD yield.
- Any hard-coded figure that should be read from chain (counts, results, rates, totals).

## 3. Proof page (`/proof/`)

### 3.1 Navigation
- `Header.tsx` `NAV` gains `{ href: "/proof/", label: "Proof" }` after Positions. It shows whether or not a wallet is connected.
- Below 640 px the header keeps today's one-link rule. On `/proof/` that link is Dashboard; on other pages Proof is not in the header.
- `Footer.tsx` gains a **Proof** link, first in the project links row, at every width.
- `src/app/proof/layout.tsx` exports `pageMetadata("/proof/")`; add the entry to `src/lib/seo/pages.ts` (title "Proof", a one-line description; indexable, not noindex). `page.tsx` frames with `Column`, so `layout.test.ts` passes.

### 3.2 Layout, top to bottom (mockup v3)
1. `PageHeader`: h1 **Proof**, one line: "Every MezoRoute contract and every transaction it has run, read from Mezo as this page loaded. No wallet needed. Each row opens the explorer."
2. A toolbar row: `Segmented` **Mainnet | Testnet** (default Mainnet, page-local state, not the app's network setting), and on the right "Block N · read Xs ago · Refresh" for the selected network.
3. **Contracts** (`Card level="panel"`, `DataTable`): columns Contract (name + one-line role), Address (explorer link), Deployed (date + block), Fee · cap per transaction, Source ("Verified", linking to the explorer's code tab). Rows: Executor V2, Leverage, Executor V1 ("Exit only, since V2"). One line under the heading: "Immutable: no owner, no proxy, no pause. Fees and caps are fixed at deploy." At the end of the card a `Notice tone="warning"`: **Unaudited**. "No outside audit or review yet; use small amounts. Leverage, Unwind, and Close have run end to end on testnet only; on mainnet they are deployed and capped but not yet run." On testnet the notice adds "Testnet tokens have no value."
4. **Every transaction** (`Card level="panel"`, `DataTable`; table from 768 px, cards below as `DataTable` already does): columns When (UTC), Action, Result, Contract, Wallet, Transaction. Newest first. Show 10, then "Show all N" expands in place. One line under the heading: "Calls to MezoRoute's contracts, newest first. Each wallet is labelled team or outside. Calls straight to Mezo's own contracts (Stability Pool deposits, gauge claims) don't go through MezoRoute and aren't listed."

The page uses only existing components (`Column`, `PageHeader`, `Segmented`, `Card`, `DataTable`, `Notice`, `Badge`) and follows `frontend/DESIGN.md`. It never mounts the wallet tree for its reads.

### 3.3 Data
- **Contracts table:** from `NetworkConfig` (address, `deployBlock`, `feeBps`, caps). Add what is missing to the config: the deploy transaction hash and the deploy date for V2, Leverage, and V1 on both networks (contracts are immutable, so these are constants; take them from `PRODUCT_SPEC.md` §20 and the explorer). "Verified" is a constant for these three addresses (all three are verified on both explorers, checked 13 Nov); the link lets anyone check.
- **Reads per network:** build a viem client from that network's `rpcUrl` (as `src/lib/reference/load.ts` does for mainnet), so the page works whatever network the app is on.
- **Transactions are built from our contracts' event logs, not from the explorer's transaction list** (anti-goal 1). Events and what each row says:

| Contract | Event | Action | Result |
|---|---|---|---|
| V1, V2 | `Entered` with `musdBorrowed > 0` | Borrow & Deploy | "{musdIn} MUSD → {liquidityOut} LP · borrowed {musdBorrowed}" |
| V1, V2 | `Entered` | Enter | "{musdIn} MUSD → {liquidityOut} LP" |
| V2 | `EnteredFromBtc` | Enter from BTC | "{btcIn} BTC → {liquidityOut} LP" |
| V2 | `Staked` in the same transaction as an entry | appends ", staked" to that row (not its own row) | |
| V1, V2 | `Exited` | Exit | "{liquidityIn} LP → {musdOut} MUSD" |
| Leverage | `OpenedLeveraged` | Open with leverage | "{btcFromUser} BTC in · borrowed {debtAmount} MUSD" |
| Leverage | `Leveraged` | Leverage | "+{btcAdded} BTC · +{debtIncrease} MUSD debt" |
| Leverage | `Unwound` | Unwind | "repaid {debtRepaid} MUSD · {collWithdrawn} BTC out" |
| Leverage | `Closed` | Close | "repaid {debtRepaid} MUSD · {collReturned} BTC back" |

  Units follow U18's planner precision (`musdShort`/`lpShort`: MUSD 2 dp, LP 4, BTC 6). Deploys are not rows; the Contracts table carries them.
- **Wallet** is the event's `caller` (executors) or `borrower` (Leverage). A Bitcoin-wallet user therefore shows as their Safe address, which is correct. Label: **team** if the address is in a fixed per-network list in `networks.ts` (`teamWallets`), else **outside**. Team today: mainnet `0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8` (user's MetaMask), `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49` (deployer); testnet the same two plus the user's Unisat Safe `0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D`. Mainnet `0xd204…190c` and `0x138f…a53d` are outside (confirmed by the user, 13 Nov).
- **When:** the block's timestamp.
- **Source of logs:** the explorer's Blockscout API (`network.explorerApiUrl`, `module=logs&action=getLogs`, by contract address only, from `deployBlock` to `latest`), as F5 already calls that API from the browser. Its rows carry `timeStamp`, so no block reads are needed. Page through results the way `fetchAllLogs` does (1,000 per page). A failed or malformed response fails the Transactions card with an error and Retry; it never shows a silently shorter list. (Decided while planning: no `eth_getLogs` fallback; F5 relies on the same API.)
- **Freshness:** read once on load and on Refresh; no polling. A failed read blanks only its own card with an error and a Retry; the other card stays.

### 3.4 Expected content today (for QA, read 13 Nov)
- Mainnet: 22 rows (V2 16, V1 6, Leverage 0); 4 wallets, 2 outside; entered 131.59 MUSD + 0.00003 BTC.
- Testnet: 85 rows (V2 47, Leverage 13, V1 25), including 7 Borrow & Deploy and the 7 Nov MetaMask Leverage round trip; 3 team wallets (the Safe may add rows the explorer's transaction list missed).

## 4. sMUSD in Compare ("level A")

### 4.1 What the vault is (read from its verified source, 13 Nov)
- Mainnet vault `0xb4D498029af77680cD1eF828b967f010d06C51CC` ("MUSD Savings Rate", sMUSD), a transparent proxy; implementation `MUSDSavingsRate` `0xb33c…9e87`, owner `0x98D8…7C7a`. Deposit and withdraw are 1:1 MUSD (`deposit(amount)`, `withdraw(amount)`).
- Yield: MUSD from the protocol (PCV) and the vault's strategy, spread by `yieldIndex` (cumulative MUSD per sMUSD, 1e18). A holder earns `balance × (yieldIndex − supplyYieldIndex[holder]) / 1e18`. **sMUSD staked in the vault's gauge belongs to the gauge, so the yield goes to the gauge, not the staker** (the source even caps the gauge's claim with `gaugeYieldClaimCap`). Staked sMUSD earns MEZO only, like staked LP gives up swap fees.
- Vault gauge (mainnet) `0x677817bF3e44b90E8F95222F75e2950b7904a401`: a Tigris `Gauge` (MEZO reward, `rewardRate`, `totalSupply`, `periodFinish`). On 13 Nov: 0.8056 MEZO/s over 151,024 sMUSD staked, week ends Thu 19 Nov 00:00 UTC.
- Testnet: no vault gauge. Two vaults use our testnet MUSD: `0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16` (906k sMUSD) and `0x40d5b453EB25DD8B1Dfd484C0B80f7eDe0DC7Def` (5.9k). Use `0x6f46…8e16`: it has 596 deposits from 190 depositors up to 13 Nov, the other 5 (checked while planning). Testnet yields are whatever the test protocol pays; show them as computed.

### 4.2 Where it shows
1. **`/compare/` (`RouteComparison`)**: a third route column, "Savings Vault (sMUSD)", sub "Mezo's MUSD savings rate". On mobile the route tabs become three. Rows:

| Row | sMUSD value |
|---|---|
| Return source | "MUSD paid by the protocol, or MEZO from the vault's gauge if you stake" |
| Swap fees (unstaked) | "Not applicable" (row label unchanged) |
| MEZO, staked, this week's rate | "≈ X MEZO a week" from the vault gauge (same maths as the LP gauge: `rewardRate × 1 week × amount / (totalSupply + amount)`), APR on mainnet from `useMezoPrice` exactly as the LP side, sub "Staking sends the MUSD yield to the gauge instead" ; "Not applicable" on testnet (no gauge) |
| Last 30 days | "MUSD yield P% (≈A% a year)" from `yieldIndex` at the F6 past block and at the head, P = Δindex / 1e18; sub "Unstaked; MEZO is not backtested" |
| {amount} MUSD on {date} | "{amount × (1 + P)} MUSD today" with the signed change, positive colour when above |
| MezoRoute fee | "None · MezoRoute doesn't route here" |
| Position after | "{amount} sMUSD, withdraw 1:1" |
| BTC exposure | "None" |
| If BTC drops 30% | "{amount} MUSD" |
| Risks | one line: "The yield is paid by Mezo's protocol and can stop or change. The vault is upgradeable by its owner, unlike MezoRoute's contracts. MEZO's rate and price change weekly." `More risks` follows the LP/SP pattern with the full list in `src/lib/routes/copy.ts` |
| Action | secondary button "Open in the Mezo app" → `network.mezoAppUrl` (external, opens a new tab) |

   The footnote gains: "The sMUSD rows read the vault's own yield index and its gauge; MezoRoute takes no fee there."
2. **Planner comparison aside** (`PlannerComparison`, both planners): a third block, "Savings Vault (sMUSD)", with the same row labels the aside uses today (this week, BTC exposure, −30% value), built by extending `plannerComparisonRows` with a `savings` side. Hidden for a BTC entry, like the SP side.
3. **"Mainnet today" card** (`MainnetReferenceCard`): a third block "Savings Vault": total sMUSD supply, sMUSD staked in the vault gauge, MUSD yield last 30 days.

### 4.3 Reads
- Add `savingsVault: { address, gauge: Address | null } | null` to `NetworkConfig` (mainnet with gauge, testnet without).
- Head reads are their own small multicall (`useSavingsVault`), pinned to the block of the snapshot it sits beside (`blockNumber`, as `useMezoPrice` does), so the figures still come from one block without touching the snapshots' positional parsers. Reads: vault `totalSupply`, `yieldIndex`; gauge `rewardRate`, `totalSupply`, `periodFinish`; voter `isAlive(gauge)` (the vault gauge is registered in the same voter as the LP gauge, checked 13 Nov). A failed read hides the sMUSD column/block with one line ("The Savings Vault could not be read right now"), never the LP or SP. (Decided while planning; replaces "in the same multicall".)
- The 30-day read joins F6's archive `eth_call` at the past block (`src/lib/compare/history.ts`); a failure blanks only the sMUSD 30-day rows, like today's history rule.
- Availability: reuse `stakeAvailability` for the vault gauge (open / between-weeks / unavailable) and its copy, so a dead or unfunded vault gauge reads "Not applicable" rather than a stale rate.

## 5. Constraints
- Every rule in `AGENTS.md` and `frontend/DESIGN.md` applies, including the guard tests (palette, typography, spacing, radius, control, heading, motion, icon, layout, colour roles). One `h1` per page.
- Pure logic lives in `src/lib/proof/` (event decoding to rows, wallet labels, log paging) and `src/lib/savings/` (vault maths), unit-tested with live fixtures: replay at least one real mainnet event of each kind to its row text, and the 13 Nov sMUSD `yieldIndex` pair (block 12,485,069 → 13,190,069: 0.214330524003397543 → 0.218681915228140081) to its 30-day figure.
- No change to contracts, `lib/tx`, `lib/quote`, the gate, params, or calls. `npm run calldata-parity` must still pass 16/16 with no payload difference.
- `npm test && npm run build` pass; QA per `AGENTS.md` (served `out/`, Playwright, no wallet and mock wallet, 375 and 1440 px, light and dark).

## 6. Left to the builder
- Deploy dates are constants in the config (immutable contracts).
- Component structure inside `components/proof/`.
- Exact sub-line wording where this spec gives none, within the copy rules (no promises, no annualising MEZO).
