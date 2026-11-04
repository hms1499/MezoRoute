# G1 Gauge Route and BTC Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One transaction enters the MUSD/BTC pool and stakes in its MEZO gauge, from MUSD or from BTC; Positions, Exit, and Compare understand staked LP.

**Architecture:** A new immutable `MezoRouteExecutorV2` adds a `stake` flag and `enterFromBtc`; V1 stays deployed and its LP stays usable. Claim, stake-all, and unstake call the gauge directly. Pure gauge maths lives in `frontend/src/lib/gauge/`; each page's existing multicall gains the gauge reads, while the MEZO price is a separate block-pinned read that may fail on its own.

**Tech Stack:** Solidity 0.8.24 (London, `via_ir`), Foundry, OpenZeppelin 4.9.0, Tigris at `0a3b5e8`; Next.js 14.2.35 static export, wagmi 2.19.5, viem 2.57.2, Vitest, Playwright MCP with the keyless mock wallet.

**Spec:** `docs/superpowers/specs/2026-11-04-g1-gauge-route-design.md` (read it; this plan argues from it). Project rules: `AGENTS.md`.

## Global Constraints

- Working deadline 13 Nov 2026, 12:30 Vietnam time. G1 should finish by 8 Nov. If short of time, cut Task 9's UI first; its contract function still ships.
- Testnet: gauge `0x72D88B0795373437E86792DEd8362D66dC43Cd2c`, voter `0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D`, no price pool.
- Mainnet: gauge `0x8Be20a5fF57E381025aE5E3A121B697269569AaF`, voter `0x48233cCC97B87Ba93bCA212cbEe48e3210211f03`, price pool `0x1D6e8D24c133535F2d00676F66a0e824f84765ff` (token0 = MEZO).
- Never read the voter from `PoolFactory.voter()`. Never use testnet gauges `0xeF07…` or `0x5083…`.
- `maxBtcIn`: mainnet 0.0125 BTC (`125e14`), testnet 12 BTC. `maxMusdIn`: unchanged. Fee 10 bps.
- No fork tests. In tests, build params before `vm.prank`. `forge fmt --check` must pass before every contract commit.
- Mainnet deployment is run by the user from the keystore. Never print or write `PRIVATE_KEY`. Testnet deploys use `contracts/.env`.
- **Do not merge to `main` until mainnet pins V2**: a push deploys production, and V2's ABI cannot call V1. Task 11 holds that gate.
- Copy rules: an APR always says it is this week's rate; staking copy always says swap fees go to veBTC voters; no "guaranteed" or "earn X%".
- UI rules from `AGENTS.md` (tokens, `Term`, `Card`, `RouteLayout`, stepper, `writeBlocker`, `sendCall`, the typography/motion/icon/palette guards) apply to every new component.
- The mock wallet is keyless, so in every "drive it" step that sends: assert the calldata of its `eth_sendTransaction`, send that same calldata with `cast send` from the testnet deployer in `contracts/.env`, point the mock at that account, and check the resulting screen. Permits and real wallet sends stay on the user's checklist.
- Before every commit: `git status` for iCloud `* 2.*` duplicates; delete only after confirming they are identical.

## Review Focus

Each line has a test in its owning task.

1. **The reward week just ended** (`now ≥ periodFinish`, alive gauge; happens every Thursday 00:00 UTC until votes distribute): the app shows no stale rate or APR, says the new rate is not set yet, and staking still works. Task 4, Task 5.
2. **The user unstaked, then closed the tab before Exit:** a reload sees wallet LP, plans no Unstake step, and finishes the exit. Task 7.
3. **LP entered through V1:** cost basis still appears, events from both executors merge in chain order, and exit asks for a new approval to V2. Task 6.
4. **The MEZO price read fails or is absent:** the pages still load and show MEZO amounts with no APR. Task 4, Task 8.
5. **"Use my balance" on a BTC entry:** BTC is also gas, so a reserve stays in the wallet and the send cannot fail for lack of gas. Task 9.

---

### Task 1: `MezoRouteExecutorV2` with staking

**Files:**
- Create: `contracts/src/MezoRouteExecutorV2.sol`, `contracts/src/interfaces/IMezoRouteExecutorV2.sol`, `contracts/src/interfaces/external/IGaugeMinimal.sol`, `contracts/test/mocks/MockVoter.sol`, `contracts/test/harness/TigrisHarnessV2.sol`, `contracts/test/v2/Stake.t.sol`
- Create by porting: `contracts/test/v2/{Enter,Exit,BorrowAndEnter,Cap,Constructor,Permit,Reentrancy,RoundTrip}.t.sol`

**Interfaces:**
- Produces: `IMezoRouteExecutorV2.EnterParams` = V1's fields + `bool stake`, last. `event Staked(address indexed recipient, uint256 liquidity)`. Errors `GaugeMismatch()`, `GaugeUnavailable()`, `StakeNotCredited()`. Immutable `gauge`. Constructor order: V1's arguments, then `address gauge_, uint256 maxBtcIn_`. `TigrisHarnessV2` exposes `gauge` (real `Gauge.sol`), `voter` (`MockVoter` with `ve()`, `setAlive(bool)`, `isAlive(address)`, and `notify(gauge, amount)` calling `notifyRewardAmount`), `mezo` (a `MockERC20Permit`), and `_deployExecutor`, `_enterParams(musdIn, recipient, stake)`.
- `Entered` and `Exited` keep V1's exact signatures.

- [ ] **Step 1: Copy V1 and the V1 tests under `test/v2/`, renamed to V2, with `stake: false`.** Add `gauge_` and `maxBtcIn_` to the constructor. Run `cd contracts && forge test --match-path 'test/v2/*'`. Expected: PASS. Leave V1's source and tests untouched: V1 is the deployed mainnet contract.

- [ ] **Step 2: Write the failing tests in `test/v2/Stake.t.sol`**

```solidity
function test_enter_stake_creditsRecipientAndLeavesNothing() public; // gauge.balanceOf(user) == liquidityOut; pool.balanceOf(user) == 0; pool.balanceOf(executor) == 0; pool.allowance(executor, gauge) == 0; emits Staked
function test_enter_noStake_keepsLpInWallet() public;                // pool.balanceOf(user) == liquidityOut; gauge.balanceOf(user) == 0
function test_borrowAndEnter_stake_creditsCaller() public;
function test_enter_stake_recipientCredited_notCaller() public;      // caller A, recipient B: gauge.balanceOf(B) == liquidityOut, gauge.balanceOf(A) == 0
function test_enter_stake_revertsOnKilledGauge() public;             // voter.setAlive(false): reverts NotAlive; a stake:false enter still succeeds
function test_enter_stake_revertsWithoutGauge() public;              // gauge_ == address(0): reverts GaugeUnavailable; stake:false succeeds
function test_constructor_revertsOnGaugeForOtherToken() public;      // GaugeMismatch
function test_enter_revertsWhenRecipientIsGauge() public;            // InvalidRecipient, for stake true and false
function test_enter_stake_ignoresPreExistingExecutorLp() public;     // LP donated to the executor first stays there; credited amount equals liquidityOut
function test_roundTrip_stake_claim_unstake_exit() public;           // voter.notify; warp 1 day; user getReward gets MEZO > 0; gauge.withdraw; executor.exit returns MUSD; another account's getReward(user) reverts NotAuthorized; MEZO kept after unstaking
function test_executorNeverTouchesMezo() public;                     // mezo.balanceOf(executor) == 0 after the round trip, and after 1 MEZO is donated it stays 1 MEZO
```

- [ ] **Step 3: Run them.** `forge test --match-path 'test/v2/Stake.t.sol'`. Expected: FAIL on missing `stake` behaviour.

- [ ] **Step 4: Implement staking in `_enter`.** When `p.stake`: mint LP to `address(this)`; after the `minLpOut` check, `pool.forceApprove(gauge, liquidityOut)`, `gauge.deposit(liquidityOut, p.recipient)`, `pool.forceApprove(gauge, 0)`; revert `StakeNotCredited` unless `gauge.balanceOf(recipient)` grew by exactly `liquidityOut`; emit `Staked`. `_requireValidRecipient` also rejects the gauge. The constructor enforces `IGaugeMinimal(gauge_).stakingToken() == pool_` when non-zero and `maxBtcIn_ != 0`.

- [ ] **Step 5: Run everything.** `forge test && forge fmt --check`. Expected: PASS, including every V1 test.

- [ ] **Step 6: Commit** `feat(contracts): MezoRouteExecutorV2 stakes LP in the gauge on entry`

---

### Task 2: `enterFromBtc`, invariants, self-audit

**Files:**
- Modify: `contracts/src/MezoRouteExecutorV2.sol`, `contracts/src/interfaces/IMezoRouteExecutorV2.sol`, `contracts/SELF_AUDIT.md`, `PRODUCT_SPEC.md` (§11.8)
- Create: `contracts/test/v2/EnterFromBtc.t.sol`, `contracts/test/invariant/ExecutorV2.invariant.t.sol`, `contracts/test/invariant/ExecutorV2Handler.sol`

**Interfaces:**
- Produces: `struct EnterFromBtcParams { uint256 btcIn; uint256 btcToSwap; uint256 minMusdFromSwap; uint256 minMusdAdded; uint256 minBtcAdded; uint256 minLpOut; uint256 deadline; address recipient; bool stake; }`. `function enterFromBtc(EnterFromBtcParams calldata p, Permit calldata btcPermit) external returns (uint256 liquidityOut)`. `event EnteredFromBtc(address indexed caller, address indexed recipient, uint256 btcIn, uint256 fee, uint256 btcToSwap, uint256 musdFromSwap, uint256 musdAdded, uint256 btcAdded, uint256 liquidityOut, uint256 musdRefund, uint256 btcRefund)`. Immutable `maxBtcIn`.

- [ ] **Step 1: Write the failing tests**

```solidity
function test_enterFromBtc_noStake_mintsLpToRecipient() public;
function test_enterFromBtc_stake_creditsGauge() public;
function test_enterFromBtc_feeInBtc() public;                  // feeRecipient gets btcIn * 10 / 10_000 BTC and 0 MUSD
function test_enterFromBtc_revertsAboveCap() public;           // AmountAboveCap at maxBtcIn + 1; passes at maxBtcIn
function test_enterFromBtc_revertsOnBadSwapAmount() public;    // InvalidSwapAmount: btcToSwap == 0, or >= btcIn - fee
function test_enterFromBtc_slippageChecks() public;            // InsufficientSwapOutput; InsufficientLiquidityOutput
function test_enterFromBtc_ignoresPreExistingBalances() public;// BTC and MUSD donated to the executor first are still there afterwards
function test_enterFromBtc_refundsToRecipient() public;
function test_enterFromBtc_permit_andFrontRunPermit() public;  // works with a signed permit; a consumed permit with an existing allowance still passes
function test_enterFromBtc_reentrancy() public;                // a reentrant token cannot re-enter
```

- [ ] **Step 2: Run them.** `forge test --match-path 'test/v2/EnterFromBtc.t.sol'`. Expected: FAIL.

- [ ] **Step 3: Implement `enterFromBtc`.** Same shape as `_enter` with the swap reversed. `addLiquidity` keeps the `(musd, btc)` token order so rounding matches the MUSD path. Share the stake and refund code with `_enter` rather than duplicating it.

- [ ] **Step 4: Add the invariant suite.** Handler actions: `enter`, `enterFromBtc`, `exit`, each with random `stake`, plus unstake, donations, and time warps. Invariants: executor LP equals donated LP only; allowances to router and gauge are 0; executor MUSD and BTC never fall below donations; executor MEZO unchanged by calls.

- [ ] **Step 5: Run everything.** `forge test && forge fmt --check`. Expected: PASS, invariants included.

- [ ] **Step 6: Update `SELF_AUDIT.md` and `PRODUCT_SPEC.md` §11.8.** Add the spec's five new invariants, each mapped to its test names. Add a V2 row to the deployment checklist.

- [ ] **Step 7: Commit** `feat(contracts): enter from BTC, V2 invariants, self-audit`

---

### Task 3: Deploy V2 to testnet and smoke it

**Files:**
- Modify: `contracts/script/Deploy.s.sol`, `contracts/test/Deploy.t.sol`, `contracts/script/smoke-testnet.sh`, `PRODUCT_SPEC.md` (§20)

**Interfaces:**
- Produces: the V2 testnet address and deploy block (Task 4 pins them), and measured gas for `enter` with stake, `enterFromBtc` with and without stake, `gauge.deposit`, `gauge.withdraw`, `gauge.getReward`, plus one `EnteredFromBtc` event with its pre-state block (Task 9's replay fixture). Record all of them in the task's commit message and in `PRODUCT_SPEC.md` §20.

- [ ] **Step 1: Write failing tests in `Deploy.t.sol`:** `maxBtcInFor(31612) == 125e14`, `maxBtcInFor(31611) == 12e18`, `gaugeFor` returns both spec addresses, unsupported chain reverts. Run: FAIL.

- [ ] **Step 2: Implement `maxBtcInFor`, `gaugeFor`; deploy V2.** Run: PASS.

- [ ] **Step 3: Dry run, then deploy on testnet.** `cd contracts && set -a && source .env && set +a && FEE_BPS=10 FEE_RECIPIENT=<same as V1> forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast`. Verify on the explorer. Read every immutable back with `cast`. Expected: gauge, `maxBtcIn`, `maxMusdIn`, fee match.

- [ ] **Step 4: Extend `smoke-testnet.sh`.** After today's flow: enter + stake → assert `gauge.balanceOf(me)` grew; wait 60 s → `earned(me) > 0`; `getReward(me)` → MEZO balance grew; `withdraw` → LP in wallet; `exit`; `enterFromBtc` with and without stake; final assertion that the executor holds no LP, MUSD, or BTC. This also proves the unverified testnet gauge behaves as `Gauge.sol` says.

- [ ] **Step 5: Run it.** `bash script/smoke-testnet.sh`. Expected: all assertions pass; output includes gas per transaction. If the testnet gauge behaves differently from the spec, stop and report before going on.

- [ ] **Step 6: Commit** `feat(contracts): deploy script and smoke run for V2` with the measurements in the message.

---

### Task 4: App config, ABIs, gauge maths

**Files:**
- Modify: `frontend/scripts/sync-abi.mjs`, `frontend/src/lib/config/networks.ts`, `frontend/src/lib/abi/*` (generated)
- Create: `frontend/src/lib/gauge/maths.ts`, `maths.test.ts`, `state.ts`, `state.test.ts`, `useMezoPrice.ts`, `frontend/src/lib/config/networks.test.ts` (or extend the existing one)

**Interfaces:**
- Consumes: V2 testnet address from Task 3.
- Note: between reward weeks the gauge is alive, so the stake box stays available and on; only the rate is hidden. This refines the spec's "on by default when active".
- Produces in `NetworkConfig`: `gauge: { address: Address; voter: Address } | null`, `mezoPricePool: { address: Address; mezoIsToken0: boolean } | null`, `legacyExecutors: { address: Address; deployBlock: bigint }[]`, `entryCapBtc: bigint`, `addresses.mezo`.
- Produces in `lib/gauge/state.ts`: `type GaugeState = { alive: boolean; rewardRate: bigint; periodFinish: bigint; totalStaked: bigint; staked: bigint; earned: bigint }`, `gaugeContracts(network, account)` (6 reads; `[]` when `gauge` is null), `GAUGE_READS = 6`, `parseGaugeState(results): GaugeState`.
- Produces in `lib/gauge/maths.ts`, all 1e18 fixed point:
  - `gaugeWeekOpen(state, now: bigint): boolean` (`alive && now < periodFinish`)
  - `lpValueInMusd(lp, pool: { reserveMusd; reserveBtc; balanceMusd; balanceBtc; totalSupply }): bigint` (mid price `reserveMusd / reserveBtc`)
  - `mezoPerWeek(rewardRate, userLp, totalStaked): bigint`
  - `emissionsApr(input: { rewardRate; mezoPrice: bigint | null; userLp; totalStaked; pool }): bigint | null`
  - `mezoPriceFromSlot0(sqrtPriceX96, mezoIsToken0): bigint`
- Produces in `useMezoPrice.ts`: `useMezoPrice(network, blockNumber): bigint | null`, reading `slot0` at that block in its own request; any failure or a null pool gives `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// maths.test.ts, mainnet figures at 4 Nov 2026
const pool = { reserveMusd: 58334540240955650544200n, reserveBtc: 743642742729788206n,
  balanceMusd: 58334540240955650544200n, balanceBtc: 743642742729788206n, totalSupply: 208278755424436519615n };
const rewardRate = 481122999331598803n, totalStaked = 171862531852085332718n;
it("derives the MEZO price from slot0", () => {
  expect(mezoPriceFromSlot0(6156700884057131831721326345n, true)).toBe(6038609436909955n);
});
it("matches mezo.org's order of magnitude: about 95.17% with no user amount", () => {
  const apr = emissionsApr({ rewardRate, mezoPrice: 6038609436909955n, userLp: 0n, totalStaked, pool })!;
  expect(apr).toBeGreaterThan(951700000000000000n);
  expect(apr).toBeLessThan(951800000000000000n);
});
it("includes the user's own deposit in the dilution", () => {
  const apr = emissionsApr({ rewardRate, mezoPrice: 6038609436909955n, userLp: 1785209539358019003n, totalStaked, pool })!;
  expect(apr).toBeGreaterThan(941900000000000000n);
  expect(apr).toBeLessThan(942000000000000000n);
});
it("gives about 2,991 MEZO a week on 1,000 MUSD of LP", () => {
  const week = mezoPerWeek(rewardRate, 1785209539358019003n, totalStaked);
  expect(week / 10n ** 18n).toBe(2991n);
});
it("gives no APR without a price", () => expect(emissionsApr({ rewardRate, mezoPrice: null, userLp: 0n, totalStaked, pool })).toBeNull());
it("handles an empty gauge and zero user LP", () => { /* totalStaked 0, userLp 0: mezoPerWeek 0n, emissionsApr null, no throw */ });
it("treats a finished week as closed", () => {
  const state = { alive: true, rewardRate, periodFinish: 100n, totalStaked, staked: 0n, earned: 0n };
  expect(gaugeWeekOpen(state, 100n)).toBe(false);
  expect(gaugeWeekOpen(state, 99n)).toBe(true);
  expect(gaugeWeekOpen({ ...state, alive: false }, 99n)).toBe(false);
});
```

`networks.test.ts`: both networks pin the spec's gauge and voter; testnet `mezoPricePool` is null and mainnet's is the spec's pool with `mezoIsToken0: true`; caps match `Deploy.s.sol`; testnet `executor` is V2 and `legacyExecutors` holds V1. `state.test.ts`: read order and parsing; `gaugeContracts` is `[]` for a null gauge.

- [ ] **Step 2: Run.** `cd frontend && npx vitest run src/lib/gauge`. Expected: FAIL, modules missing.

- [ ] **Step 3: Implement.** `sync-abi.mjs` writes `mezoRouteExecutor.ts` from `MezoRouteExecutorV2`, adds `gauge.ts` (`gaugeAbi`, from `Gauge`), adds a small hand-written CL `slot0` ABI where `poolAbi` lives, and includes `Gauge` in `tigrisErrors.ts`. Run `forge build`, then `npm run sync-abi`. Mainnet keeps V1 as `executor` on this branch until Task 11.

- [ ] **Step 4: Run.** `npx vitest run`. Expected: new tests PASS; fix type errors from the new `stake` field by adding `stake: false` only where needed to keep `npm run build` green until Task 5.

- [ ] **Step 5: Add the merge guard** `it("pins V2 on mainnet before merge")` in `networks.test.ts`, marked `it.fails` today, asserting mainnet `legacyExecutors` is non-empty. It starts as an expected failure, and Task 11 removes `.fails`. This makes the merge gate visible in the suite.

- [ ] **Step 6: Commit** `feat(frontend): gauge config, ABIs, and maths`

---

### Task 5: LP route stakes in one transaction

**Files:**
- Modify: `frontend/src/lib/routes/musd-btc-lp/{intent,params,snapshot,steps,receipt,useEntryFlow}.ts` and their tests, `frontend/src/lib/quote/gas.ts`, `frontend/src/lib/errors/*`, `frontend/src/components/lp/LpRoutePage.tsx` and the confirm and receipt components
- Create: `frontend/src/components/lp/StakeToggle.tsx`, `frontend/src/lib/gauge/copy.ts`

**Interfaces:**
- Consumes: `GaugeState`, `gaugeContracts`, `gaugeWeekOpen`, `mezoPerWeek`, `emissionsApr`, `useMezoPrice`.
- Produces: `EntryIntent.stake: boolean` (URL `stake=0` means off; absent means on, then the page applies availability), `EnterParams.stake`, `LpRouteSnapshot.gauge: GaugeState | null`, `findStakedEvent(logs, executor): { recipient; liquidity } | null`, `stakeAvailability(gauge, now): "open" | "between-weeks" | "unavailable"`, `ENTER_STAKE_GAS`, and `entryGasUnits` gains `stake`.

- [ ] **Step 1: Write the failing tests**

```ts
it("defaults to staking and keeps stake=0 in the URL", ...);          // parseEntryIntent / entryQuery round trip
it("sends stake in EnterParams", ...);                                 // buildEnterParams(..., stake: true).stake === true; encodeEnterCall decodes it back
it("reports availability", () => {                                     // alive and open: "open"; alive and now >= periodFinish: "between-weeks"; dead or null: "unavailable"
});
it("never stakes when unavailable", ...);                              // the effective stake value is false for "unavailable" whatever the URL says
it("stakes between weeks without a rate", ...);                        // "between-weeks": box available and on; copy shows the not-set message and no MEZO figure
it("finds the Staked event and shows both receipt rows", ...);
it("decodes a gauge's NotAlive into the closed-staking outcome", ...); // decodeError → "Staking is closed; enter without staking", with an action that clears stake
it("uses the measured budget", ...);                                   // entryGasUnits({ stake: true, ... }) from Task 3's figures
```

- [ ] **Step 2: Run.** `npx vitest run src/lib/routes src/lib/errors src/lib/quote`. Expected: FAIL.

- [ ] **Step 3: Implement.** Budgets are Task 3's measured gas + 5%, rounded up to 5,000. `copy.ts` holds, exactly: `Stake to earn MEZO`; `≈ {amount} MEZO a week at this week's rate. While staked, swap fees go to veBTC voters instead of you.`; between weeks: `The new week's MEZO rate is not set yet. Staking still works.`

- [ ] **Step 4: Run.** `npx vitest run && npm run build`. Expected: PASS.

- [ ] **Step 5: Drive it.** Serve `frontend/out`, use Playwright with the mock wallet on testnet: amount → review → confirm with staking on and off, at 360 and 1440 px. Send one stake entry on testnet. Expected: receipt shows entered and staked; `gauge.balanceOf` grew; no horizontal scroll; 0 console errors.

- [ ] **Step 6: Commit** `feat(frontend): stake in the gauge when entering the LP route`

---

### Task 6: Positions shows staked LP, pending MEZO, and gauge actions

**Files:**
- Modify: `frontend/src/lib/positions/{snapshot,view,history,history-reader,usePositionsHistory}.ts` and tests, `frontend/src/components/positions/{LpPositionCard,FeesCard,PositionsPage}.tsx`, `frontend/src/lib/quote/gas.ts`, `frontend/src/lib/glossary.ts`
- Create: `frontend/src/lib/gauge/actions.ts`, `actions.test.ts`, `useGaugeActions.ts`, `frontend/src/components/positions/GaugeCard.tsx`

**Interfaces:**
- Consumes: Task 4's gauge state and maths.
- Produces: `PositionsSnapshot.gauge: GaugeState | null`. `LpView.balance` becomes wallet + staked, with new `walletLp` and `stakedLp`. `historyExecutors(network): { address; deployBlock }[]`. `gaugeActionBlock({ network, walletChainId, action: "claim" | "stake" | "unstake", state, walletLp, lacksGas })`. `findRewardEvent(logs, gauge)`. `useGaugeActions(account): { claim, stakeAll, unstakeAll, pending }`. Glossary ids `gauge`, `emissions`. Budgets `GAUGE_DEPOSIT_GAS`, `GAUGE_WITHDRAW_GAS`, `GAUGE_CLAIM_GAS`.

- [ ] **Step 1: Write the failing tests**

```ts
it("values wallet and staked LP together", ...);                      // walletLp 1, stakedLp 2: balance 3; value and exit quote use 3
it("merges V1 and V2 history in chain order", ...);                   // events from both executors sort by block, then log index; cost basis covers LP entered via V1
it("scans each executor from its own deploy block", ...);
it("keeps V1 LP exitable: asks for a new V2 approval", ...);          // allowance to V1 is ignored; allowance is read for the V2 spender
it("empties only when wallet and staked are both zero", ...);         // a fully staked position is not `empty`
it("blocks claim at zero earned; blocks stake at zero wallet LP; blocks unstake at zero staked", ...);
it("shows no fees message when fully staked", ...);                   // FeesCard copy helper
it("finds the claim event for the receipt note", ...);
```

- [ ] **Step 2: Run.** `npx vitest run src/lib/positions src/lib/gauge`. Expected: FAIL.

- [ ] **Step 3: Implement.** Claim simulates first, like `useClaimFees`, then `gauge.getReward(account)`. Stake all: exact LP approval when needed, then `gauge.deposit(walletLp)`. Unstake all: `gauge.withdraw(staked)`. All go through `sendCall` with measured budgets and `writeBlocker`. Definitions, exactly: Gauge `A contract that pays MEZO to people who stake their LP in it; while staked, swap fees go to veBTC voters.` Emissions `MEZO paid to a gauge each week. veBTC voters decide how much each gauge gets.`

- [ ] **Step 4: Run.** `npx vitest run && npm run build`. Expected: PASS, guards included.

- [ ] **Step 5: Drive it** with the mock wallet and the QA account staked in Task 5: card shows staked LP and pending MEZO; claim and unstake all, stake all round trip on real testnet; both themes, 360 and 1440 px. Expected: on-chain balances match the card; 0 console errors.

- [ ] **Step 6: Commit** `feat(frontend): staked LP and MEZO on Positions`

---

### Task 7: Exit unstakes first

**Files:**
- Modify: `frontend/src/lib/positions/{exit-intent,exit-steps,exit-gate,exit-preview,useExitFlow}.ts` and tests, `frontend/src/lib/quote/gas.ts`, `frontend/src/components/positions/{ExitForm,ExitPage,ExitStepper}.tsx`

**Interfaces:**
- Consumes: `LpView.walletLp`, `LpView.stakedLp`, `gaugeAbi`.
- Produces: `exitPlan(walletLp, stakedLp, percent): { liquidityIn: bigint; unstake: bigint }`. `ExitStepKind` gains `"unstake"`. `exitSteps(kind, allowance, liquidityIn, unstake)`. `exitGasUnits` gains `unstake`.

- [ ] **Step 1: Write the failing tests**

```ts
it("spends wallet LP first", () => expect(exitPlan(40n, 60n, 50)).toEqual({ liquidityIn: 50n, unstake: 10n }));
it("needs no unstake when the wallet covers it", () => expect(exitPlan(60n, 40n, 50)).toEqual({ liquidityIn: 50n, unstake: 0n }));
it("Max is exact", () => expect(exitPlan(1n, 2n, 100)).toEqual({ liquidityIn: 3n, unstake: 2n }));
it("orders the steps", () => {
  expect(exitSteps("eoa", 0n, 50n, 10n)).toEqual(["unstake", "permit", "exit"]);
  expect(exitSteps("smart-account", 0n, 50n, 10n)).toEqual(["unstake", "approve", "exit"]);
  expect(exitSteps("eoa", 50n, 50n, 0n)).toEqual(["exit"]);
});
it("resumes after an unstake and a reload", () => {
  // first load: wallet 0, staked 100, percent 100 → unstake 100. After Unstake confirms, reload: wallet 100, staked 0 → no unstake step, permit + exit
  expect(exitPlan(100n, 0n, 100)).toEqual({ liquidityIn: 100n, unstake: 0n });
});
it("pins liquidityIn when the flow starts, and re-quotes after unstaking", ...);
it("says two transactions only when unstaking is needed", ...);
it("notes that pending MEZO stays claimable", ...);
```

- [ ] **Step 2: Run.** `npx vitest run src/lib/positions`. Expected: FAIL.

- [ ] **Step 3: Implement.** The unstake step is a direct `gauge.withdraw(unstake)`. The permit is signed only after it confirms, because its deadline runs while the user waits.

- [ ] **Step 4: Run.** `npx vitest run && npm run build`. Expected: PASS.

- [ ] **Step 5: Drive it:** full, partial, and interrupted exits on real testnet, including a reload between Unstake and Exit. Expected: MUSD arrives; pending MEZO is still claimable after; no step repeats.

- [ ] **Step 6: Commit** `feat(frontend): exit unstakes first and resumes after a reload`

---

### Task 8: Compare and true copy

**Files:**
- Modify: `frontend/src/lib/compare/comparison.ts`, `frontend/src/components/dashboard/{compare-rows.ts,RouteComparison.tsx,MainnetReferenceCard.tsx}`, `frontend/src/lib/dashboard/snapshot.ts`, `frontend/src/lib/reference/*`, `frontend/src/lib/routes/copy.ts`, `frontend/src/lib/landing/{sections,view}.ts`, `frontend/src/components/landing/LpIllustration.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`, and their tests
- Modify, if the landing simulator's parity test needs it: `frontend/src/lib/landing/simulate.ts`

**Interfaces:**
- Consumes: `emissionsApr`, `mezoPerWeek`, `gaugeWeekOpen`, `useMezoPrice`.
- Produces: `ComparedRoutes.lp` (status ok) gains `gauge: { open: boolean; mezoPerWeek: bigint; apr: bigint | null } | null`. `lpGaugeRows(compared): Row[]`. `DashboardSnapshot.gauge`. `addresses.pcv` (mainnet `0x391EcC7ffEFc48cff41D0F2Bb36e38b82180B993`; testnet from `BorrowerOperations.pcv()`). A `protocolOwnedSp: bigint` read (`getCompoundedMUSDDeposit(PCV)`), and `DashboardSnapshot.troveDebt` if not already present.

- [ ] **Step 1: Write the failing tests**

```ts
it("shows swap fees and MEZO as alternatives", ...);                  // rows "Swap fees (unstaked)" and "MEZO, staked, this week's rate"; never a summed figure
it("labels the MEZO figure as this week's rate", ...);                // includes "Changes weekly with veBTC votes; MEZO's price can fall"
it("shows MEZO amounts without APR when the price is null", ...);     // apr null: amount row present, no percent, no thrown error
it("shows the not-set message between weeks", ...);                   // no stale rate
it("dilutes by the amount entered", ...);                             // a larger amount gives a lower apr
it("does not backtest emissions", ...);                               // 30-day rows unchanged; LP history still fees only, and labelled so
it("states the Stability Pool's real source", ...);                   // includes the live Trove debt figure from the snapshot
it("marks the protocol's share of the Stability Pool", ...);          // MainnetReferenceCard stat says "protocol-owned" with the read figure
it("copy no longer claims LP pays only fees", ...);                   // LP_RETURN_SOURCE mentions both; landing sections checked
```

- [ ] **Step 2: Run.** `npx vitest run src/lib/compare src/components/dashboard src/lib/landing src/lib/routes`. Expected: FAIL.

- [ ] **Step 3: Implement.** `LP_RETURN_SOURCE`: `Swap fees from traders, or MEZO from the gauge if you stake`. Add to `LP_RISKS`: `MEZO rewards change weekly and are paid in a token whose price can fall.` Add a Stability Pool row or line that uses the read figures, in the spirit of: `Returns come only from liquidations. Open Trove debt today: {debt} MUSD.`

- [ ] **Step 4: Run.** `npx vitest run && npm run build`. Expected: PASS, including landing parity and all guards.

- [ ] **Step 5: Drive it:** dashboard on testnet (MEZO amounts, no APR) and mainnet (APR). Compare the mainnet APR with mezo.org/earn/pools at the same time. Expected: within about 2 points, explained by MUSD's price and rounding; 0 console errors.

- [ ] **Step 6: Commit** `feat(frontend): Compare shows gauge rewards; copy matches the chain`

---

### Task 9: Enter from BTC (first to cut)

**Files:**
- Modify: `frontend/src/lib/quote/entry.ts` and test, `frontend/src/lib/routes/musd-btc-lp/{intent,params,permit,steps,gate,preview,receipt,useEntryFlow}.ts` and tests, `frontend/src/lib/positions/{history,history-reader,cost-basis}.ts` and tests, `frontend/scripts/live/quote-accuracy.live.ts`, `frontend/src/lib/quote/gas.ts`, `frontend/src/components/lp/LpRoutePage.tsx`
- Create: `frontend/src/lib/routes/musd-btc-lp/asset.ts`, `asset.test.ts`

**Interfaces:**
- Consumes: Task 3's replay fixture.
- Produces: `EntryIntent.asset: "musd" | "btc"` (URL `asset=btc`), `quoteEntryFromBtc(pool, btcIn, feeBps): BtcEntryQuote | null`, `buildEnterFromBtcParams(...)`, `encodeEnterFromBtcCall(params, permit)`, `btcPermitDomain(network)` (`("BTC", "1", chainId, btc)`), `findEnteredFromBtcEvent(logs, executor)`, `maxBtcSpendable(balance, gasReserve): bigint`, `btcEntryCost(event): bigint`.

- [ ] **Step 1: Write the failing tests**

```ts
it("replays the live EnteredFromBtc event to the wei", ...);          // Task 3's fixture: btcToSwap, musdFromSwap, musdAdded, btcAdded, liquidityOut, refunds all exact
it("uses the same deposit rounding as the MUSD route", ...);          // shared add-liquidity helper; existing MUSD replays unchanged
it("takes the fee in BTC", ...);
it("leaves a gas reserve on Use my balance", () => {                  // balance 100, reserve 30 → 70; reserve above balance → 0n, and the gate reports needs-gas
  expect(maxBtcSpendable(100n, 30n)).toBe(70n);
  expect(maxBtcSpendable(20n, 30n)).toBe(0n);
});
it("blocks above entryCapBtc", ...);
it("hides the BTC asset in borrow mode", ...);                        // mode=borrow&asset=btc parses to musd
it("signs the BTC permit domain, matching the chain", ...);           // recover a signature against ("BTC","1",31611,0x7b7C…)
it("smart accounts approve BTC exactly", ...);
it("counts cost basis from the event's own swap", () => {
  // (btcIn − btcRefund) × musdFromSwap / btcToSwap
});
it("merges BTC and MUSD entries in history", ...);
```

- [ ] **Step 2: Run.** `npx vitest run src/lib/quote src/lib/routes src/lib/positions`. Expected: FAIL.

- [ ] **Step 3: Implement.** Refactor `simulateEntry` so the swap direction is separate from the shared `(musd, btc)` deposit rounding. The gas reserve is the entry's gas units × 2 × gas price. Extend `quote-accuracy` to replay `EnteredFromBtc`.

- [ ] **Step 4: Run.** `npx vitest run && npm run build && npm run quote-accuracy`. Expected: PASS; accuracy reports exact results for both entry types on testnet.

- [ ] **Step 5: Drive it:** MUSD | BTC switch, "Use my balance", staked and unstaked BTC entries on real testnet at 360 and 1440 px. Expected: wallet keeps its reserve; Positions shows correct cost basis; 0 console errors.

- [ ] **Step 6: Commit** `feat(frontend): enter the LP route from BTC`

---

### Task 10: Full QA and documents

**Files:**
- Modify: `PRODUCT_SPEC.md` (lines 35, 73–74, 164, 329, Wave 2 list), `AGENTS.md` (a G1 entry under Frontend, V2 notes under Contracts), `README.md`, `docs/STATUS.md`, `frontend/src/lib/routes/copy.ts` if QA finds gaps

- [ ] **Step 1: Run the full matrix** on the local build with the mock wallet: route, confirm, receipt, positions, exit, dashboard, landing × 360/768/1024/1440 × both themes, reduced motion, keyboard to every new control. Expected: no horizontal scroll; 0 console errors; focus rings present; `Term` popovers inside the gutter.

- [ ] **Step 2: Check a Bitcoin-wallet path** as far as an agent can: mock a smart account for stake, claim, unstake, and the exit stepper. Expected: approvals rather than permits; `decodeError` outcomes for a `0x` relay and `ExecutionFailure`. Real Bitcoin-wallet sends go on the user's checklist.

- [ ] **Step 3: Run everything.** `cd contracts && forge test && forge fmt --check`, then `cd ../frontend && npm test && npm run build`. Expected: PASS; record counts.

- [ ] **Step 4: Update the documents.** Correct every stale claim the spec lists, and state the two-transaction exit and the BTC cap in the README.

- [ ] **Step 5: Commit** `docs: G1 gauge route in AGENTS, spec, README, and STATUS`

- [ ] **Step 6: Whole-branch review** with a fresh reviewer, per `AGENTS.md`. Fix findings, then rerun Step 3.

---

### Task 11: Mainnet deployment and real round trip (approval gate)

**Files:**
- Modify: `frontend/src/lib/config/networks.ts`, `frontend/src/lib/config/networks.test.ts`, `PRODUCT_SPEC.md` (§11.1, §20), `contracts/SELF_AUDIT.md`, `docs/STATUS.md`

- [ ] **Step 1: Ask the user for approval to deploy,** showing fee 10 bps, recipient, `maxMusdIn` 1,000, `maxBtcIn` 0.0125, gauge, and the dry-run output. Deploying is irreversible. Do not continue without a yes.

- [ ] **Step 2: Agent runs the dry run.** `FEE_BPS=10 FEE_RECIPIENT=<addr> forge script script/Deploy.s.sol --rpc-url mezo_mainnet --sender <addr>`. Expected: constructor checks pass; gas estimate shown.

- [ ] **Step 3: The user broadcasts** by adding `--account mezo-mainnet --broadcast` in their own terminal, and sends the agent the address.

- [ ] **Step 4: Agent verifies** with `forge verify-contract … --chain 31612 --verifier blockscout --verifier-url https://api.explorer.mezo.org/api`, and reads back every immutable. Expected: all match.

- [ ] **Step 5: Pin.** Mainnet `executor` = V2, `legacyExecutors` = `[{ 0x046449b1229C863e278f369869BA10e12bd80d9E, 12_524_142n }]`, and remove `.fails` from the merge guard. Run `npm test && npm run build`. Expected: PASS. Commit `feat(frontend): pin the mainnet V2 executor`.

- [ ] **Step 6: Merge on the user's word.** Use `superpowers:finishing-a-development-branch`. A push to `main` deploys production; confirm the deployed site serves the new chunk.

- [ ] **Step 7: Real round trip with the user's wallet, about 10 MUSD, through production:** enter + stake → wait → claim MEZO → exit (unstake, then exit). Then read the executor: it holds nothing. Run `QUOTE_NETWORK=mainnet npm run quote-accuracy`. Expected: exact or skipped with reason.

- [ ] **Step 8: Record** hashes, cost, and addresses in `PRODUCT_SPEC.md` §11.1 and §20, `SELF_AUDIT.md`, and `docs/STATUS.md`. Commit `docs: G1 mainnet record`.
