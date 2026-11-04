# G1: Gauge route and entry from BTC (design)

Date: 4 Nov 2026 · Wave 2, first item · Inputs: `docs/wave2/2026-11-04-wave1-feedback.md` · Branch: `feat/g1-gauge-route`

## Why

MezoRoute's LP route earns 1.7% in swap fees on a pool whose gauge pays 94.1% in MEZO to stakers (mezo.org, 4 Nov 2026). The product's job is to answer "where should my MUSD go", and today it leaves out the largest return on its own pool. Staking gives outside users a real reason to use the app, which the Wave 1 judge asked for, and it adds the MEZO integration we said did not exist. Our 30 Sep research that no gauge pays MEZO is out of date.

The user approved the order on 4 Nov 2026: gauge first, then entry from BTC, then Unwind and Leverage (a separate spec).

## Goals

- A user enters the MUSD/BTC pool and stakes in the gauge in **one transaction**.
- Positions shows staked and unstaked LP together, pending MEZO, and Claim, Stake, Unstake, and Exit.
- Compare shows fees and MEZO separately, on the user's own amount.
- A user can enter from BTC alone, without holding MUSD first.
- Every public claim about gauges, veMEZO, and the Stability Pool is true.

## Non-goals

- Concentrated pools (BTC/MUSD-200): TVL is $35k and they need range management.
- Auto-compounding or selling MEZO for the user.
- veBTC or veMEZO features, bribes, voting.
- A sMUSD deposit route: 0.03% fees plus 1.6% MEZO, with about 130k of user money. Compare may list it read-only if time allows.
- Unwind and Leverage.
- Bitcoin-wallet mainnet proof (the relayer stays untested on mainnet; the README's limitation stays).

## Anti-goals

The design fails, even if it works technically, if:

- 94% reads as a promise. The app must never show an APR without saying it is this week's rate.
- A user believes they keep swap fees while staked.
- Any path lets MezoRoute or anyone else take staked LP or MEZO.

## Chain facts (4 Nov 2026)

| | Testnet | Mainnet |
|---|---|---|
| Pool | `0xd16A…6AA9` | `0x52e6…cefb` |
| Gauge | `0x72D88B0795373437E86792DEd8362D66dC43Cd2c` | `0x8Be20a5fF57E381025aE5E3A121B697269569AaF` |
| Voter | `0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D` | `0x48233cCC97B87Ba93bCA212cbEe48e3210211f03` |
| `voter.isAlive(gauge)` | true | true |
| `voter.gauges(pool)` | the gauge above | the gauge above |
| Reward token | MEZO `0x7B7c…0001` | MEZO `0x7B7c…0001` |
| `rewardRate` | 1.281 MEZO/s | 0.481 MEZO/s |
| Staked LP | 9,392.8 | 171.86 of 208.28 |
| `periodFinish` (both) | 1793836800 | 1793836800 |
| MEZO/MUSD pool for the price | none found | `0x1D6e8D24c133535F2d00676F66a0e824f84765ff` (CL, token0 = MEZO; `slot0` gives ≈ 0.00604 MUSD) |
| Source verified on the explorer | no | yes (`PoolGauge`) |

Two other testnet gauges for this pool exist on older voters and pay BTC at rate 0 (`0xeF07…`, `0x5083…`). Do not use them. `PoolFactory.voter()` points at a different address on both networks (empty on testnet), so never read the voter from the factory.

`Gauge.sol` (`lib/tigris/.../gauges/Gauge.sol`, matching the mainnet ABI):

- `deposit(amount, recipient)` pulls LP from the caller and credits `recipient`. It reverts with `NotAlive` on a killed gauge.
- `withdraw(amount)` returns LP to the caller only, and has no alive check, so unstaking always works.
- `getReward(account)` may only be called by `account` or the voter.
- `withdraw` stores earned rewards, so MEZO stays claimable after unstaking.
- Rewards run in 7-day periods set by veBTC votes.

The testnet gauge's bytecode contains the `deposit(uint256,address)`, `withdraw`, and `getReward` selectors. Its source is not verified, so the smoke run must exercise all of them, plus `earned`.

## Contract: `MezoRouteExecutorV2`

A new immutable contract; V1 stays deployed. A wrapper around V1 was rejected: entering from BTC would swap twice, and V1's events would name the wrapper as the caller. Both features ship in one contract because each mainnet deployment is irreversible and run by the user.

**Same as V1:** `enter`, `borrowAndEnter`, `exit`, no owner/admin/proxy, deltas measured inside the call, exact allowances reset to 0, borrowed MUSD to the caller.

**New constructor arguments:**
- `gauge_`: may be `address(0)`. Otherwise require `IGauge(gauge_).stakingToken() == pool_`, or revert `GaugeMismatch`.
- `maxBtcIn_`: non-zero per-transaction cap. Mainnet 0.0125 BTC (≈ $977 at 78,198), testnet 12 BTC, pinned per chain in `Deploy.s.sol` like `maxMusdInFor`.

**`EnterParams` gains `bool stake`.** When true:

1. `addLiquidity` mints LP to the executor.
2. Check `liquidityOut >= minLpOut` as today.
3. `pool.forceApprove(gauge, liquidityOut)`, `gauge.deposit(liquidityOut, recipient)`, `pool.forceApprove(gauge, 0)`.
4. Require that `gauge.balanceOf(recipient)` grew by exactly `liquidityOut`.
5. Revert `GaugeUnavailable` if the gauge is `address(0)`.
6. Emit `Staked(recipient, liquidity)`.

`Entered` keeps its exact signature, so cost basis and the accuracy script keep working.

**`enterFromBtc(EnterFromBtcParams p, Permit btcPermit)`**, with `btcIn, btcToSwap, minMusdFromSwap, minMusdAdded, minBtcAdded, minLpOut, deadline, recipient, stake`:

- Revert `AmountAboveCap` above `maxBtcIn`.
- Fee: `btcIn × feeBps / 10,000`, paid in BTC to `feeRecipient`.
- Swap `btcToSwap` BTC to MUSD, add liquidity, stake or not, refund leftovers to `recipient`.
- BTC permit domain is `("BTC", "1", chainId, 0x7b7C…)`, already proven on chain (PRODUCT_SPEC §4).
- Emit `EnteredFromBtc(caller, recipient, btcIn, fee, btcToSwap, musdFromSwap, musdAdded, btcAdded, liquidityOut, musdRefund, btcRefund)`.

**`_requireValidRecipient`** also rejects the gauge: LP or refunds sent there are unrecoverable.

**`exit`** is unchanged. It cannot unstake, because `gauge.withdraw` pays only its caller. Exit from a staked position is therefore two transactions, and the UI says so.

**New spec 11.8 invariants, each mapped to tests in `SELF_AUDIT.md`:**

- The executor holds no LP after any call.
- The gauge allowance is 0 after any call.
- Staked LP is credited only to `recipient`.
- BTC held before a call is never paid out (`enterFromBtc` uses the same deltas).
- The executor never touches MEZO.

**Tests:** extend `TigrisHarness` with the real `Gauge.sol` and a mock voter (`ve()`, `isAlive`). Fork tests remain impossible (AGENTS). Cover: stake on and off through `enter`, `borrowAndEnter`, and `enterFromBtc`; killed gauge; gauge `address(0)`; both caps; recipient checks; reentrancy; pre-existing executor balances; rewards accruing to the recipient and claimable by them only; a full round trip (enter + stake → claim → unstake → exit). Extend the invariant handler. Run the existing suite against V2.

## App

**Config (`networks.ts`):**
- `gauge: { address, voter } | null`.
- `mezoPricePool: { address, mezoIsToken0 } | null`: mainnet as above, testnet `null`.
- `executor` becomes V2. Add `legacyExecutors: { address, deployBlock }[]` (V1), scanned for history.
- `entryCapBtc`.

**Reads:** add to the LP route and Positions multicalls, so all values stay in one block: `isAlive`, `rewardRate`, `periodFinish`, gauge `totalSupply`, `balanceOf(account)`, `earned(account)`, `slot0` of the price pool.

**Pure maths in a new `src/lib/gauge/` (unit-tested):**

```
active     = isAlive && now < periodFinish
lpValue(x) = x × (poolMusd + poolBtc × poolMidPrice) / lpSupply
mezoWeek(amount)  = rewardRate × 604,800 × userLp / (stakedLp + userLp)
emissionsApr(amt) = rewardRate × 31,536,000 × mezoPrice / lpValue(stakedLp + userLp)
```

Pool mid price, not the oracle (the F6 rule). Include the user's own deposit in the denominator, so a large amount shows its own dilution. With no price pool (testnet) or a failed read, `emissionsApr` is `null` and the UI shows MEZO amounts only. The price is for display and is never used for a send. Check the result against mezo.org's 94.14% at the same block during QA.

**LP route (`/route/lp/`):**
- A "Stake to earn MEZO" checkbox, on by default when `active`, hidden when the gauge is `null` or not alive.
- Under it: "≈ {mezoWeek} MEZO a week at this week's rate. While staked, swap fees go to veBTC voters instead of you."
- `stake` goes in the URL intent, so reloads keep it.
- The receipt names both steps from `Entered` and `Staked`.

**Entry from BTC:** an asset switch MUSD | BTC on the same page, `asset=btc` in the URL. The quote mirrors the BTC side exactly (extend `src/lib/quote/entry.ts`; pool order is mapped by address). "Use my balance" leaves a gas reserve, because BTC is also the gas token. Borrow & Deploy stays MUSD only.

**Positions:**
- `LpPositionCard` shows wallet LP and staked LP; value and cost basis use the sum.
- A new MEZO row: pending amount and Claim, a direct `gauge.getReward(account)`, simulated first like `claimFees`.
- Stake all: exact LP approval then `gauge.deposit(amount)`, direct, no executor, no fee.
- Unstake all: direct `gauge.withdraw(balance)`.
- Fees: staked LP earns none, so `FeesCard` copy says so when the position is fully staked.

**Exit (`/positions/lp/exit/`):**
- `liquidityIn = (wallet + staked) × percent / 100`; Max is exact.
- Unstake `max(0, liquidityIn − wallet)` first, so wallet LP goes first.
- Stepper: Unstake → LP permit or approval → Exit. A step is skipped when not needed.
- The form says "Two transactions: unstake, then exit" when unstaking is needed.
- If the user stops after Unstake, reloading shows LP in the wallet, and the flow resumes with no special handling.
- Pending MEZO is not claimed automatically. A note says it stays claimable.

**Compare (`RouteComparison`):**
- The LP route splits into "Swap fees" and "MEZO at this week's rate", marked as alternatives, because a staked position earns only MEZO.
- The MEZO figure is labelled as this week's rate, not a forecast, with "Changes weekly with veBTC votes; MEZO's price can fall".
- The 30-day LP fee history stays. Do not backtest emissions.

**History:** `history-reader` scans V1 and V2. Cost basis for BTC entries uses the event's own swap: `(btcIn − btcRefund) × musdFromSwap / btcToSwap`. The cache stays per executor.

**Copy that must change:**
- `src/lib/routes/copy.ts` and the landing: no more "fees only" for LP.
- Stability Pool: returns come only from liquidations, and today's Trove debt is about 18.6k MUSD. State this from reads, not as fixed text where possible.
- `glossary.ts`: add Gauge and Emissions.
- `MainnetReferenceCard`: "Share of MUSD supply" for the Stability Pool must say the deposit is protocol-owned (read `getCompoundedMUSDDeposit(PCV)`).

**Errors:** add the gauge's `NotAlive` and `NotAuthorized` and the V2 errors to `decodeError` with recovery actions. A gauge that dies between quote and send becomes "Staking is closed; enter without staking".

**Gas:** measure `enter` with stake, `enterFromBtc`, `deposit`, `withdraw`, and `getReward` on testnet first, then add budget constants (the AGENTS rule). Bitcoin wallets leave gas to the relayer.

## Documents to correct

- `PRODUCT_SPEC.md`: §1 (line 35), §4 (lines 73–74), §15 "Out of scope" (line 164) and the APY line, the "Never imply" rule (line 329), the Wave 2 list, and new invariants in §11.8.
- `contracts/SELF_AUDIT.md`, `AGENTS.md` (a G1 entry), `docs/STATUS.md`, `README.md`.
- The AKINDO resubmission and deck are handled at the end of Wave 2, not here.

## Rollout

1. Contracts and tests.
2. Testnet deploy and an extended `smoke-testnet.sh`: enter + stake, wait, `earned` > 0, claim, unstake, exit, and `enterFromBtc` both ways.
3. App work with Playwright and the mock wallet on testnet, both themes, 360–1440 px.
4. Mainnet deploy, **run by the user from the keystore**, then verification and pinning. Approval gate.
5. One real mainnet round trip through the production UI with the user's wallet, about 10 MUSD: enter + stake, claim, unstake, exit. Record hashes in `PRODUCT_SPEC.md` §20.

Working deadline: **13 Nov 2026, 12:30 Vietnam time** (platform record; the page says 15 Nov). If time runs short, the BTC entry UI is cut before anything else in this spec. Its contract function still ships, because redeploying is costly. Unwind and Leverage need time after this, so G1 should finish by 8 Nov.

## Calls made by the agent (for the user to check)

- A new V2 contract rather than a wrapper around V1.
- Stake is on by default when the gauge is live.
- Mainnet BTC cap 0.0125 BTC and testnet 12 BTC.
- Same 10 bps fee, taken in BTC on BTC entries. Staking, claiming, and unstaking are free and direct.
- Wallet LP is spent before staked LP on partial exits.
- `withdraw` and `getReward` are separate user actions, not merged into exit.
- MEZO price comes from the mainnet MEZO/MUSD pool ($7.7k TVL, display only, can be skewed). Testnet shows MEZO amounts with no APR.
- The BTC entry UI is the first thing to cut.

## Left to the builder

File layout under `src/lib/gauge/`, the exact wording of secondary copy, how the checkbox looks, and the order of Positions rows, within the existing design system (`AGENTS.md`).
