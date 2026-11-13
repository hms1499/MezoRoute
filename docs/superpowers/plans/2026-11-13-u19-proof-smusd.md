# U19 Proof page and sMUSD comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wallet-free `/proof/` page listing MezoRoute's contracts and every call to them on both networks, and the MUSD Savings Vault (sMUSD) as a read-only third option in Compare, the planners' comparison, and "Mainnet today".

**Architecture:** Pure modules in `src/lib/proof/` (event logs → rows) and `src/lib/savings/` (vault state and maths), each fed by a thin hook. Proof reads logs from the explorer's Blockscout API (generalising F5's `fetchAllLogs`) and the head block through a per-network viem client. sMUSD reads are their own small multicall pinned to the neighbouring snapshot's block, plus the vault's `yieldIndex` at F6's past block.

**Tech Stack:** Next 14 static export, React 18, wagmi 2.19.5, viem 2.57.2, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-u19-proof-smusd-design.md`

## Global Constraints

- Every rule in `AGENTS.md` and `frontend/DESIGN.md`; all guard tests stay green (palette, typography, spacing, radius, control, heading, motion, icon, layout, colour roles, design-doc). One `h1` per page.
- Planner precision: `musdShort` (MUSD 2 dp), `lpShort` (LP 4 dp), BTC 6 dp (`formatToken(x, 18, 6)`), MEZO 2 dp on planners.
- No change to contracts, `lib/tx`, `lib/quote`, gates, params, or calls; `npm run calldata-parity` 16/16 with no payload difference.
- Never annualise or project MEZO beyond "this week's rate"; never imply a staker also earns the vault's MUSD yield.
- No hard-coded figure that should come from chain (counts, results, rates, totals).
- Team wallets: mainnet `0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`, `0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49`; testnet those two plus `0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D`. Every other wallet is "outside".
- Run from `frontend/`: `npm test` and `npm run build` must pass before each commit that touches `src/`.

## Review Focus

1. A Bitcoin-wallet (Safe) call reaches our contract internally: the row must still appear, with the Safe as the wallet. → Task 3 builds rows from logs only (never from a tx list); Task 3 test feeds a log whose `caller` is the testnet Safe and expects `walletKind: "team"`.
2. The explorer answers a full page (1,000 logs) or "No logs found": paging must continue, and an empty history must render the empty state, not an error. → Task 2 tests both.
3. A tx with `Entered` and `Staked` must be one row ("Enter, staked"), not two; a `Staked` without an entry in the same tx is ignored. → Task 3 test.
4. The vault gauge between weeks or dead must not show a stale rate. → Task 6 test (`savingsWeek` returns `between-weeks` / `unavailable` with null figures).
5. A failed vault read must not blank the LP or SP column. → Task 7 test (rows without savings when the state is null) and Task 9 load test (savings rejection leaves `reference`).

---

### Task 1: Network config: deployments, team wallets, savings vault

**Files:**
- Modify: `frontend/src/lib/config/networks.ts`
- Test: `frontend/src/lib/config/networks.test.ts`

**Interfaces:**
- Produces:
  - `export type Deployment = { address: Address; deployBlock: bigint; deployTx: Hex; deployedAt: string }` (`deployedAt` = ISO date `YYYY-MM-DD`, UTC).
  - `NetworkConfig.executor: (Deployment & { feeBps: bigint }) | null`; `legacyExecutors: Deployment[]`; `leverage: (Deployment & { feeBps; maxBtcFlash; maxMusdFlash }) | null`.
  - `NetworkConfig.teamWallets: readonly Address[]`.
  - `NetworkConfig.savingsVault: { address: Address; gauge: Address | null } | null`.

- [ ] **Step 1: Write the failing tests** in `networks.test.ts`:
  - `it("pins every deployment's transaction and date")`: mainnet executor `deployTx` `0x4338b6c8024f0516d66bbe5a96ec8e30b012c30be8e5e397673f279cb167bbe8`, `deployedAt` `"2026-11-06"`; mainnet V1 `0x8aa55418f1da98ea1700c9e950f01d8cadf94fc34633650f5e60f9e68aafb71d` `"2026-10-15"`; mainnet leverage `0xd38ed08ce7f778122cc44173151e16eb6c8aa6a6e6873f2aa943323214076048` `"2026-11-07"`; testnet executor `0x5346cb0a04fcc4d86e63a1a133ec53f1d7a7f1064fea9c5c397cbbfd695f9fb9` `"2026-11-04"`; testnet V1 `0x060ae9ed9c8e30db6327457b710f3263e0e4ad89394fed734a17a5f8c4d51fb3` `"2026-10-02"`; testnet leverage `0x22c07ba40588a0fca71b29b8cd5d507843db83fd562fae75f431d12744ae31db` `"2026-11-07"`.
  - `it("lists the team's wallets per network")`: the Global Constraints lists, compared lower-cased.
  - `it("points at the live savings vaults")`: mainnet `{ address: 0xb4D498029af77680cD1eF828b967f010d06C51CC, gauge: 0x677817bF3e44b90E8F95222F75e2950b7904a401 }`; testnet `{ address: 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16, gauge: null }`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/config/networks.test.ts` — expect FAIL (properties missing).
- [ ] **Step 3: Implement** the types and values above in `networks.ts` (comments say where each value comes from; `explorer` checked 13 Nov). Fix every type error the new required fields raise (test fixtures that build a `NetworkConfig` by hand get the fields too).
- [ ] **Step 4: Run** `npx vitest run src/lib/config` then `npx tsc --noEmit -p .` — PASS, no type errors.
- [ ] **Step 5: Commit** `feat(frontend): U19 deployments, team wallets, and savings vaults in the network config`.

### Task 2: Explorer logs by address

**Files:**
- Modify: `frontend/src/lib/stability-pool/explorer.ts`
- Test: `frontend/src/lib/stability-pool/explorer.test.ts`

**Interfaces:**
- Produces: `ExplorerLog` gains `timeStamp?: Hex`. `LogQuery = { address: Address; topic0?: Hex; topic1?: Hex }`. `explorerLogsUrl(apiUrl, query & { fromBlock })` adds `topic0`/`topic1` only when set and `topic0_1_opr=and` only when both are set. `fetchAllLogs(fetchJson, apiUrl, query, fromBlock = 0n)`.
- Consumers today (F5 `history.ts`) keep passing both topics; behaviour unchanged.

- [ ] **Step 1: Failing tests:** `it("asks for one address's logs without topics")` → the URL has `address`, `fromBlock=13031359`, and no `topic0`, `topic1`, or `topic0_1_opr`; `it("pages an address-only query from the given block")` → first request `fromBlock=13031359`, a 1,000-log page then a 3-log page returns 1,001 unique logs (the repeated boundary log de-duplicated); `it("returns no logs for 'No logs found'")` still passes.
- [ ] **Step 2: Run** `npx vitest run src/lib/stability-pool/explorer.test.ts` — FAIL.
- [ ] **Step 3: Implement** the optional topics and the `fromBlock` start.
- [ ] **Step 4: Run** `npx vitest run src/lib/stability-pool` — PASS (F5 tests unchanged).
- [ ] **Step 5: Commit** `refactor(frontend): explorer logs by address and from a block`.

### Task 3: Proof rows from event logs

**Files:**
- Create: `frontend/src/lib/proof/rows.ts`, `frontend/src/lib/proof/fixtures.ts`
- Test: `frontend/src/lib/proof/rows.test.ts`

**Interfaces:**
- Consumes: `ExplorerLog` (Task 2); `mezoRouteExecutorAbi`, `mezoRouteLeverageAbi` (`src/lib/abi/`); `musdShort`, `lpShort` (`components/lp/units.ts`).
- Produces:
  ```ts
  export type ProofSource = { contract: string; logs: ExplorerLog[] }; // contract = display name, e.g. "Executor V2"
  export type ProofAction = "enter" | "borrowAndDeploy" | "enterFromBtc" | "exit" | "openLeveraged" | "leverage" | "unwind" | "close";
  export type ProofRow = {
    key: string; // `${txHash}:${logIndex}`
    txHash: Hex; block: bigint; logIndex: number; time: bigint; // time = log timeStamp, unix seconds
    action: ProofAction; staked: boolean; label: string; result: string;
    contract: string; wallet: Address; walletKind: "team" | "outside";
  };
  export function proofRows(sources: readonly ProofSource[], teamWallets: readonly Address[]): ProofRow[];
  ```
- Rules (spec §3.3 table): decode each log with both ABIs (`decodeEventLog`, check `decoded.eventName`; skip logs neither decodes); `Entered` with `musdBorrowed > 0` → `borrowAndDeploy` "Borrow & Deploy", result `"{musdShort(musdIn)} → {lpShort(liquidityOut)} · borrowed {musdShort(musdBorrowed)}"`; `Entered` → "Enter" `"{musdShort(musdIn)} → {lpShort(liquidityOut)}"`; `EnteredFromBtc` → "Enter from BTC" `"{btc6(btcIn)} → {lpShort(liquidityOut)}"`; `Exited` → "Exit" `"{lpShort(liquidityIn)} → {musdShort(musdOut)}"`; `OpenedLeveraged` → "Open with leverage" `"{btc6(btcFromUser)} in · borrowed {musdShort(debtAmount)}"`; `Leveraged` → "Leverage" `"+{btc6(btcAdded)} · +{musdShort(debtIncrease)} debt"`; `Unwound` → "Unwind" `"repaid {musdShort(debtRepaid)} · {btc6(collWithdrawn)} out"`; `Closed` → "Close" `"repaid {musdShort(debtRepaid)} · {btc6(collReturned)} back"` (`btc6(x)` = `${formatToken(x, 18, 6)} BTC`). A `Staked` log sets `staked` and appends ", staked" to the entry row of the same tx; alone it makes no row. Wallet = topic1 (`caller` / `borrower`); `walletKind` by case-insensitive match. Sort newest first: block desc, then logIndex desc.

- [ ] **Step 1: Capture fixtures.** Write `fixtures.ts` with the raw explorer logs (address-only `getLogs` result objects, unedited) of: mainnet V2 `0x415b5af4…1445` (Entered + Staked, caller team `0x375a…`), `0x730c33bd…89c2` (Exited), `0xeac5130e…3caa` (EnteredFromBtc + Staked), V1 `0xb401267a…60fb` (Entered), V2 `0x1713…2b5c` (Entered + Staked, caller outside `0xd204…190c`); testnet one `borrowAndEnter` tx on V2 or V1 and the 7 Nov Leverage round trip `0x8ecad1a4…df90`, `0x430fb080…b74c`, `0x8d880f97…fff9`, `0x381aac38…b7b`. Fetch with `curl "$API/api?module=logs&action=getLogs&fromBlock=<block>&toBlock=<block>&address=<contract>"` and keep only the logs of those txs. Add one synthetic copy of a testnet log with topic1 set to the Unisat Safe `0x4543…e22D`.
- [ ] **Step 2: Failing tests** in `rows.test.ts`:
  - `it("reads a staked MUSD entry as one row")`: `0x415b` → one row, `label` "Enter, staked", `result` "10.00 MUSD → " + lpShort(17962…), `walletKind` "team".
  - `it("reads exits, BTC entries, V1 entries, and outside wallets")`: `0x730c` "Exit" result ends "9.96 MUSD"; `0xeac5` "Enter from BTC, staked" result starts "0.000030 BTC"; `0xb401` contract "Executor V1"; `0x1713` `walletKind` "outside".
  - `it("names Borrow & Deploy by its borrowed MUSD")`: testnet borrowAndEnter row `action` "borrowAndDeploy", result contains "borrowed".
  - `it("reads the Leverage round trip")`: four rows with actions `close`, `leverage`, `unwind`, `openLeveraged` in that (newest-first) order; the open row's result contains "0.043000 BTC in".
  - `it("labels a Bitcoin wallet's Safe as its wallet")`: the synthetic Safe log → `wallet` the Safe, `walletKind` "team".
  - `it("ignores a lone Staked log and logs no ABI knows")`.
- [ ] **Step 3: Run** `npx vitest run src/lib/proof` — FAIL.
- [ ] **Step 4: Implement** `proofRows`.
- [ ] **Step 5: Run** — PASS. **Commit** `feat(frontend): U19 proof rows from executor and Leverage events`.

### Task 4: Proof contracts and loading

**Files:**
- Create: `frontend/src/lib/proof/contracts.ts`, `frontend/src/lib/proof/load.ts`, `frontend/src/lib/proof/useProof.ts`
- Test: `frontend/src/lib/proof/contracts.test.ts`, `frontend/src/lib/proof/load.test.ts`

**Interfaces:**
- Consumes: `Deployment`, `teamWallets` (Task 1); `fetchAllLogs`, `browserFetchJson`, `FetchJson` (Task 2); `proofRows` (Task 3).
- Produces:
  ```ts
  export type ProofContract = Deployment & { name: "Executor V2" | "Leverage" | "Executor V1"; role: string; terms: string };
  export function proofContracts(network: NetworkConfig): ProofContract[]; // V2, Leverage, then legacy executors as "Executor V1"
  export async function loadProofRows(network: NetworkConfig, fetchJson: FetchJson): Promise<ProofRow[]>;
  export function useProof(network: NetworkConfig): { rows: ProofRow[] | undefined; error: Error | null; retry: () => void };
  export function useHeadBlock(network: NetworkConfig): { number: bigint; readAt: number } | undefined; // readAt = Date.now() when read
  ```
- Roles: V2 "LP route, stake, BTC entry"; Leverage "Leverage, Unwind, Close"; V1 "Exit only, since V2". `terms`: V2 `"10 bps · 1,000 MUSD or 0.0125 BTC"` on mainnet (from `feeBps`, `entryCap`, `entryCapBtc`), Leverage `"10 bps · 2,500 MUSD or 0.0125 BTC"` (`maxMusdFlash`, `maxBtcFlash`), V1 `"10 bps · 1,000 MUSD"` (V1 shares `entryCap`). Testnet the same from its config (1,000,000 MUSD / 12 BTC).
- `loadProofRows` fetches each contract from its `deployBlock` in parallel and rejects if any fetch rejects. `useProof`/`useHeadBlock` use TanStack Query keyed by `network.id`, `retry: false`, no polling; `useHeadBlock` builds one module-level viem client per network from `rpcUrl` on first use (as `useMainnetReference` does).

- [ ] **Step 1: Failing tests:** `contracts.test.ts` → mainnet list names/terms exactly as above and testnet terms `"10 bps · 1,000,000 MUSD or 12 BTC"`; `load.test.ts` → with a fake `fetchJson` answering per address (from fixtures) the rows come back merged and newest first; a rejecting fetch for one contract rejects the whole load (no shorter list).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 proof contracts and loading`.

### Task 5: The Proof page, nav, footer, metadata

**Files:**
- Create: `frontend/src/app/proof/layout.tsx`, `frontend/src/app/proof/page.tsx`, `frontend/src/components/proof/ProofPage.tsx`, `frontend/src/components/proof/ContractsCard.tsx`, `frontend/src/components/proof/TransactionsCard.tsx`
- Modify: `frontend/src/components/Header.tsx` (`NAV`), `frontend/src/lib/ui/nav.ts` (`onMobile`), `frontend/src/components/Footer.tsx`, `frontend/src/lib/seo/pages.ts`
- Test: `frontend/src/lib/ui/nav.test.ts`, `frontend/src/components/proof/proof.test.ts`, existing `layout.test.ts` and SEO tests

**Interfaces:**
- Consumes: Task 4 (`proofContracts`, `useProof`, `useHeadBlock`); `explorerAddressUrl`, `explorerTxUrl`; `DataTable`, `Card`, `Notice`, `Segmented`, `Badge`, `Button`, `LoadingCard`.
- Produces: `ContractsCard({ network, contracts })` and `TransactionsCard({ network, rows, error, onRetry })` as pure render components (testable with `renderToStaticMarkup`).

Page rules (spec §3.2): `h1` "Proof" with `className="text-title"` (no back link, like Positions) and the spec's subtitle; `Segmented` Mainnet | Testnet (page state, default `"mainnet"`); right of it "Block N · read Xs ago · Refresh" from `useHeadBlock` (hidden while unknown or failed); Contracts card columns Contract (name + role), Address (link), Deployed (`deployedAt` as "6 Nov 2026" + "block 13,031,359", linking `deployTx`), Fee · cap (`terms`), Source ("Verified" with a check icon, linking `${explorerUrl}/address/<address>?tab=contract`); then `Notice tone="warning"` **Unaudited** with the spec's sentence, plus " Testnet tokens have no value." on testnet. Transactions card: columns When (UTC, "12 Nov 13:04"), Action, Result, Contract, Wallet (short address `0xd204…190c` + `Badge` "team"/"outside"), Transaction (short hash link); first 10 rows, then a secondary `Button` "Show all N" that expands in place; empty state "No transactions yet."; on error a `Notice` with Retry instead of the table. Nav: `NAV` adds `{ href: "/proof/", label: "Proof" }`; `onMobile(href, path)`: on Positions or Proof pages show only "/", elsewhere only "/positions/", never "/proof/". Footer: an internal `Link` "Proof" first in the project links. `PAGES["/proof/"] = { title: "Proof", description: "Every MezoRoute contract and every transaction it has run on Mezo, read from chain." }`. `page.tsx` = `Column` + `dynamic(() => import("@/components/proof/ProofPage"), { ssr: false })`.

- [ ] **Step 1: Failing tests:**
  - `nav.test.ts`: `onMobile("/", "/proof/")` true; `onMobile("/positions/", "/proof/")` false; `onMobile("/proof/", "/")` false; existing cases unchanged.
  - `proof.test.ts`: `ContractsCard` for mainnet renders "Executor V2", "0xb346…7915" linking the explorer, "6 Nov 2026", "Verified", and "Unaudited"; for testnet also "Testnet tokens have no value"; `TransactionsCard` with 25 fixture-shaped rows renders 10 rows and "Show all 25", a row with "outside", and with `error` renders "Retry" and no table; with `rows: []` renders "No transactions yet."
- [ ] **Step 2: Run** `npx vitest run src/lib/ui src/components/proof` — FAIL.
- [ ] **Step 3: Implement** the components, page, nav, footer, and SEO entry.
- [ ] **Step 4: Run** `npm test` (layout, heading, guard tests included) then `npm run build` (postbuild metadata check) — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 Proof page with contracts and every transaction`.

### Task 6: Savings vault state, maths, reads

**Files:**
- Create: `frontend/src/lib/abi/savings.ts`, `frontend/src/lib/savings/state.ts`, `frontend/src/lib/savings/maths.ts`, `frontend/src/lib/savings/useSavingsVault.ts`, `frontend/src/lib/savings/history.ts`
- Test: `frontend/src/lib/savings/maths.test.ts`, `frontend/src/lib/savings/state.test.ts`, `frontend/src/lib/savings/history.test.ts`

**Interfaces:**
- Consumes: `savingsVault` (Task 1); `gaugeAbi`, `voterAbi`; `stakeAvailability`, `StakeAvailability`; `HistoryClient`, `RouteHistory`, `withTimeout`, `HISTORY_TIMEOUT_MS` (`lib/compare/history.ts`); `annualise` (`lib/compare/window.ts`).
- Produces:
  ```ts
  export type SavingsGauge = { alive: boolean; rewardRate: bigint; periodFinish: bigint; totalStaked: bigint };
  export type SavingsState = { totalSupply: bigint; yieldIndex: bigint; gauge: SavingsGauge | null };
  export function savingsContracts(network: NetworkConfig); // [] as never when no vault; vault totalSupply, yieldIndex, then (gauge set) voter.isAlive(gauge), gauge rewardRate, periodFinish, totalSupply; each with chainId
  export function parseSavingsState(network: NetworkConfig, results: readonly unknown[]): SavingsState;
  export type SavingsWeek = { availability: StakeAvailability; mezoPerWeek: bigint | null; apr: bigint | null };
  export function savingsWeek(input: { state: SavingsState; amount: bigint; now: bigint; mezoPrice: bigint | null }): SavingsWeek;
  export function savingsReturn(pastIndex: bigint, nowIndex: bigint): bigint; // MUSD per sMUSD over the window, 1e18 = 100%
  export function useSavingsVault(network: NetworkConfig, blockNumber: bigint | undefined): SavingsState | null | undefined; // undefined loading, null none/failed
  export async function fetchSavingsIndexes(client: HistoryClient, network: NetworkConfig, pastBlock: bigint, headBlock: bigint): Promise<{ past: bigint; now: bigint }>;
  export function useSavingsHistory(history: RouteHistory | undefined): { past: bigint; now: bigint } | null | undefined;
  ```
- Maths: `savingsWeek` → no gauge: `{ availability: "unavailable", mezoPerWeek: null, apr: null }`; otherwise `availability = stakeAvailability({ ...gauge, staked: 0n, earned: 0n }, now)`; only `"open"` gets figures: `mezoPerWeek(rewardRate, amount, totalStaked)` (same function as the LP gauge) and `apr = rewardRate × 31,536,000 × mezoPrice / (totalStaked + amount)` (sMUSD = MUSD 1:1; null without a price). `savingsReturn = nowIndex − pastIndex` (the vault's index is already MUSD per sMUSD, 1e18).
- `useSavingsVault` = wagmi `useReadContracts({ contracts: savingsContracts(network), allowFailure: false, blockNumber, query: { enabled: network.savingsVault !== null, retry: false } })` → null on error or no vault. `useSavingsHistory` = TanStack Query keyed by `["savings-history", chainId, pastBlock]`, enabled with `history`, `retry: false`, `withTimeout`.

- [ ] **Step 1: Failing tests** (13 Nov mainnet values):
  - `maths.test.ts`: `savingsWeek` with `rewardRate 805620943026785549n`, `totalStaked 151023584600783358698787n`, `amount 1_000e18`, `now` before `periodFinish 1795046400n`, alive → `availability "open"`, `formatToken(mezoPerWeek, 18, 0) === "3,205"`; `mezoPrice null` → `apr null`; `now` past `periodFinish` → `"between-weeks"`, figures null; `alive false` → `"unavailable"`; `gauge null` → `"unavailable"`. `savingsReturn(214330524003397543n, 218681915228140081n) === 4351391224742538n` and `formatPercent(…, 2) === "0.44%"`.
  - `state.test.ts`: `savingsContracts(networks.testnet)` has 2 reads (no gauge), mainnet 6; `parseSavingsState` maps them, `gauge` null on testnet.
  - `history.test.ts`: a fake `HistoryClient` returns the two indexes for the two blocks → `{ past, now }`; asks `yieldIndex` at exactly `pastBlock` and `headBlock`.
- [ ] **Step 2: Run** `npx vitest run src/lib/savings` — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 savings vault reads and maths`.

### Task 7: sMUSD column in Compare

**Files:**
- Modify: `frontend/src/components/dashboard/compare-rows.ts`, `frontend/src/components/dashboard/RouteComparison.tsx`, `frontend/src/lib/compare/view.ts`, `frontend/src/lib/routes/copy.ts`
- Test: `frontend/src/components/dashboard/compare-rows.test.ts`, `frontend/src/lib/compare/view.test.ts`

**Interfaces:**
- Consumes: Task 6 (`useSavingsVault`, `useSavingsHistory`, `savingsWeek`, `savingsReturn`).
- Produces:
  ```ts
  // copy.ts
  export const SAVINGS_RETURN_SOURCE = "MUSD paid by the protocol, or MEZO from the vault's gauge if you stake";
  export const SAVINGS_RISKS: string[]; // [0] "The yield is paid by Mezo's protocol and can stop or change." [1] "The vault is upgradeable by its owner, unlike MezoRoute's contracts." [2] "MEZO's rate and price change weekly."
  // compare-rows.ts
  export function savingsGaugeRows(week: SavingsWeek | null): Row[]; // label "MEZO, staked, this week's rate"; [] when unavailable or null
  export function savingsAmountRows(amount: bigint | null): Row[]; // "Position after" `${musd(amount)} as sMUSD`, sub "Withdraw 1:1"; "BTC exposure" "None"; `If BTC drops 30%` musd(amount)
  // view.ts
  export function savingsHistoryLine(ret: bigint, seconds: bigint): string; // "MUSD yield 0.44% (≈5.3% a year)"
  ```
- Gauge row copy: open → value `≈ {formatToken(mezoPerWeek, 18, 4)} MEZO a week`, sub `{apr line as lpGaugeRows} Staking sends the MUSD yield to the gauge instead.`; between-weeks → "New week's rate not set yet".
- `RouteComparison`: `RouteId = "lp" | "sp" | "savings"`; the savings route (title "Savings Vault (sMUSD)", tagline "Mezo's MUSD savings rate", rows: Return source, gauge rows, history row (`savingsHistoryLine`, sub "Unstaked; MEZO is not backtested"), backtest row (`amount + amount × ret / 1e18`), MezoRoute fee "None · MezoRoute doesn't route here", amount rows; risks `SAVINGS_RISKS`; CTA `ButtonLink external` "Open in the Mezo app" → `network.mezoAppUrl`) is present only when `useSavingsVault(network, snapshot.block?.number)` returns a state; when it returns null a one-line muted note "The Savings Vault could not be read right now." shows under the field. `GRID` gets a fourth column only when the savings route is present. Footnote appends: " The sMUSD rows read the vault's own yield index and its gauge; MezoRoute takes no fee there." Rows still match by label (`Cell` shows "Not applicable" for a missing label).

- [ ] **Step 1: Failing tests:** `savingsGaugeRows` open (contains "MEZO a week" and "MUSD yield to the gauge"), between-weeks, unavailable → `[]`, null → `[]`; `savingsAmountRows(1_000e18)` labels equal the LP amount rows' labels and "None" exposure; `savingsAmountRows(null)` → `[]`; `savingsHistoryLine(4351391224742538n, 30n * 86400n)` → `"MUSD yield 0.44% (≈5.3% a year)"`; no row text matches `/total|combined|plus/i`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 sMUSD column in Compare`.

### Task 8: sMUSD in the planners' comparison

**Files:**
- Modify: `frontend/src/lib/flow/planner-comparison.ts`, `frontend/src/components/lp/PlannerComparison.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`, `frontend/src/components/stability-pool/SpRoutePage.tsx`
- Test: `frontend/src/lib/flow/planner-comparison.test.ts`, `frontend/src/components/lp/planner-comparison.test.ts`

**Interfaces:**
- Consumes: Task 6 (`useSavingsVault`, `savingsWeek`).
- Produces: `PlannerCompare = { lp; sp; savings?: PlannerCompareRow[] }`; `export function plannerSavingsRows(input: { amountMusd: bigint; week: SavingsWeek | null }): PlannerCompareRow[]` with rows "You get" "MUSD yield" sub "or MEZO if staked"; "This week" open+apr → `≈ {apr 1 dp}% APR staked`, open → `≈ {mezo 2 dp} MEZO a week staked`, otherwise "MUSD yield · variable"; "BTC exposure" "None"; "If BTC −30%" `{amount 2 dp} MUSD`; "Exit" "Any time, 1:1, in the Mezo app". `PlannerComparison` renders a third `Route` "Savings Vault (sMUSD)" after the two when `rows.savings` is set, with a neutral dot (`bg-muted`). Both pages read `useSavingsVault(network, snapshot.blockNumber)` and pass `savings` only when the state is non-null and the entry is MUSD.

- [ ] **Step 1: Failing tests:** `plannerSavingsRows` open with apr → "This week" contains "APR staked"; between-weeks → "MUSD yield · variable"; −30% row = the amount; no row says "a year" without "APR staked" (never a bare projection). Render test: with `savings` rows the card shows "Savings Vault (sMUSD)"; without, it does not.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 sMUSD in the planners' comparison`.

### Task 9: Savings Vault in "Mainnet today"

**Files:**
- Modify: `frontend/src/lib/reference/load.ts`, `frontend/src/components/dashboard/MainnetReferenceCard.tsx`
- Test: `frontend/src/lib/reference/load.test.ts`

**Interfaces:**
- Consumes: `savingsContracts`, `parseSavingsState`, `fetchSavingsIndexes`, `savingsReturn` (Task 6).
- Produces: `MainnetReferenceData.savings: { supply: bigint; staked: bigint | null; ret: bigint | null; seconds: bigint | null } | null` — head reads in their own `allSettled` branch (a rejection → `savings: null`, card still renders); `ret` from `fetchSavingsIndexes` at the history's blocks (null when history or that read fails).
- Card: a third block "Savings Vault" with `Stat`s "Deposits" (`{supply 0 dp} sMUSD`), "Staked for MEZO" (`{staked 0 dp} sMUSD`), "Last 30 days" (`savingsHistoryLine` or "Unavailable"); the grid becomes `sm:grid-cols-2 lg:grid-cols-3`.

- [ ] **Step 1: Failing tests:** savings head read rejects → data has `reference` and `savings: null`; all succeed → `savings.supply` equals the fake vault supply and `ret` equals `now − past`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): U19 Savings Vault in Mainnet today`.

### Task 10: Docs, QA, parity

**Files:**
- Modify: `AGENTS.md` (one U19 bullet under Frontend), `frontend/DESIGN.md` (only if a new pattern appeared; none expected), `docs/STATUS.md` (U19 row, session log)

- [ ] **Step 1:** `cd frontend && npm test && npm run build` — PASS; read the output.
- [ ] **Step 2: Browser QA** on the served export (`python3 -m http.server <port> --bind 127.0.0.1` on `frontend/out`), Playwright, no wallet: `/proof/` at 1440 and 375 px, light and dark — mainnet shows 22 rows (V2 16, V1 6) with `0xd204…190c` and `0x138f…a53d` as outside; testnet ≥ 85 rows incl. Borrow & Deploy and the 7 Nov Leverage round trip; header shows Proof from 640 px, footer link at 375 px; no horizontal scroll. `/compare/` on mainnet shows the sMUSD column (MEZO a week ≈ 3,2xx for 1,000 MUSD while the week is open) and on testnet the column without a MEZO row; LP and SP planners show the third block; "Mainnet today" on testnet shows the Savings Vault block.
- [ ] **Step 3:** `npm run calldata-parity` against `main` and this branch — 16/16, no payload difference.
- [ ] **Step 4:** Update `AGENTS.md`, `docs/STATUS.md`; **commit** `docs: U19 built and QA'd`.
