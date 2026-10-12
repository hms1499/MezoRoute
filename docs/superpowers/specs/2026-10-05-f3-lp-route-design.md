# F3 — LP route: quote engine, route page, confirm stepper, receipt (design)

Date: 5 Oct 2026 · Task: F3 in `PRODUCT_SPEC.md` §16 · Depends on: F1 (`2026-10-05-f1-app-shell-design.md`), F2 (`2026-10-05-f2-dashboard-design.md`), C1 · Branch: `feat/f3-lp-route`

## Goal

A user with MUSD in their wallet can deposit it into the MUSD/BTC LP through `MezoRouteExecutor.enter` (spec §7 Flow C):

1. **Route page** `/route/lp`: enter an amount and see an exact preview (swap, deposit, LP, minimums, fee, price impact, gas, exposure before and after, risks).
2. **Confirm page** `/route/lp/confirm`: a fresh quote with a 60-second expiry and a stepper. An EOA signs a MUSD permit; a smart account (Bitcoin wallet) sends an exact approval. Then the user sends `enter`.
3. **Receipt page** `/tx/?hash=`: progress until the transaction is confirmed, then values from the `Entered` event only (FR-11).

The user confirmed this scope on 5 Oct 2026: entry with wallet MUSD only. LP exit is F7, Borrow & Deploy is F4, and the route comparison is F6.

## Decisions

| Topic | Decision |
|---|---|
| State between pages | **The URL carries only user intent** (`amount`, `slippage`); each page reads the chain again in one multicall snapshot. Reloading or opening a link always shows a fresh quote, and no page reuses a stale one. (Chosen over an in-memory store, which loses state on reload, and over Router-only quoting, which cannot model the post-swap deposit.) |
| Optimal swap | Solved for Tigris, which **moves the swap fee out of the pool** (`Pool._update0` sends it to `PoolFees`). Spec §12's formula assumes the fee stays in the pool (Uniswap V2) and leaves a MUSD residue: 0.97 MUSD on a 1,000,000 MUSD deposit at today's testnet reserves, versus 0 with the corrected formula. Spec §12 is updated. |
| Quote maths | An exact integer simulation that mirrors every rounding step of Pool and Router. It reproduces the three live S1 `Entered` events to the wei (verified 5 Oct 2026). |
| Permit vs approval | EOA: EIP-2612 permit for exactly `musdIn`. Smart account, or a wallet of unknown kind: an exact `approve` transaction (FR-06, FR-23). Either step is skipped when the allowance already covers `musdIn`. |
| Re-quoting | The permit binds only amount and deadline, so the quote is refreshed after the signature and again just before sending (§12) without signing again. |
| Before sending | `enter` is simulated with the signed permit from the address that will call it (the EOA or the Safe). A simulated revert is decoded and nothing is sent. |
| Hand-off to the receipt | As soon as `enter` has a hash, the app navigates to `/tx/?hash=`, which waits for the receipt. A reload during confirmation keeps tracking the transaction. |
| Networks without an executor | Mainnet stays read-only (F1). The route page shows the write-blocker message and no quote; the dashboard shows no "Deposit into LP" button there. |
| Dashboard entry point | Until F6, the readiness card shows **Deposit into LP** in the `ready` state. |

## Chain facts (verified with `cast` on testnet, 5 Oct 2026)

- MUSD supports EIP-2612: `nonces(address)`, `DOMAIN_SEPARATOR()` = `0x6f9f5c5d441374bdc3939f5da85a145469d7ffbc96bfe0cce59e5de7d8f1474f`, and `eip712Domain()` gives name "Mezo USD", version "1". It has no `version()` or `PERMIT_TYPEHASH()` getter. No permit has gone through the executor on chain yet; F3's QA run is the first.
- `PoolFactory.getFee(pool, false)` = 4 (bps) on testnet; spec §12 records 30 on mainnet. The fee is in bps over 10,000.
- Tigris `Pool.swap` takes `fee = amountIn × feeBps / 10000` (rounded down) and transfers it to `PoolFees`, so the reserves grow by `amountIn − fee`. `getAmountOut` = `(amountIn − fee) × reserveOut / (reserveIn + amountIn − fee)`.
- `Router.addLiquidity` → `_addLiquidity` → `quoteLiquidity`: with desired `(A, B)` against reserves `(rA, rB)`, `B* = A × rB / rA`. If `B* ≤ B`, the router deposits `(A, B*)`, else `(B × rA / rB, B)`. `Pool.mint` gives `min(a0 × supply / r0, a1 × supply / r1)`.
- The executor passes `musdIn − fee − musdToSwap` and the whole swap output as desired amounts, and requires `0 < musdToSwap < musdIn − fee` (`InvalidSwapAmount`).
- Testnet pool reserves: about 102.6M MUSD and 1,302.7 BTC (mid price about 78,760 MUSD/BTC, against an oracle near 86,000). `token0` is MUSD on testnet and BTC on mainnet (F2).
- S1 gas: `enter` used 328k–433k gas. A relayed Safe call adds `baseGas` 197,471 (`0x3035F`) to the refund.

## 1. Quote engine (`src/lib/quote/`)

Pure functions over bigint; nothing reads the chain.

```ts
type PoolState = { reserveMusd: bigint; reserveBtc: bigint; totalSupply: bigint; poolFeeBps: bigint };
type EntryQuote = {
  musdIn: bigint; fee: bigint; net: bigint;          // net = musdIn − fee
  musdToSwap: bigint; btcFromSwap: bigint;
  musdAdded: bigint; btcAdded: bigint; liquidity: bigint;
  musdRefund: bigint; btcRefund: bigint;
  priceImpact: bigint;                               // 1e18 = 100%, against the pre-trade mid price
  after: PoolState;                                  // reserves and supply after the entry
};
```

- **Optimal swap.** With `f` the pool fee as a fraction, `g = 1 − f`, net amount `a`, and MUSD reserve `r`: after the swap the deposit ratio must equal the new reserve ratio, which gives `g²s² + r(2 − f)s − a·r = 0`, so
  `s = (√(r²(2 − f)² + 4g²·a·r) − r(2 − f)) / (2g²)`, computed in bps-scaled integers with `isqrt`.
- **Simulation.** `simulateEntry(pool, net, s)` follows the contract step by step (swap fee, `getAmountOut`, post-swap reserves, `quoteLiquidity`, `mint`) and returns the amounts and refunds. `quoteEntry` = optimal `s` + simulation. The S1 replays call `simulateEntry` with S1's `s` (a naive half split).
- **Minimums.** For slippage `bps ∈ {50, 100, 200}`: `min = expected × (10000 − bps) / 10000`, rounded down, for `minBtcFromSwap`, `minMusdAdded`, `minBtcAdded`, and `minLpOut`. Slippage is never raised silently, and the UI warns strongly at 2%.
- **Price impact.** `1 − btcFromSwap × r / (s × R)` as a 1e18 ratio, rounded up, with `r` and `R` the MUSD and BTC reserves before the swap. It includes the pool fee.
- **Exposure after entry.** `applyEntry(snapshot, quote)` returns the dashboard snapshot with MUSD reduced by `musdIn − musdRefund`, LP balance and supply raised by `liquidity`, and the reserves from `after`. F2's `exposure()` and `drawdownScenarios()` then give the "after" panel.
- **Gas estimate.** `gas units × gasPrice`, labelled as an estimate. The budget is `enter` 450,000 (S1 max 433,422), plus 60,000 for an approval, plus 197,471 per relayed Safe call. The needs-gas check keeps F2's 3,000,000-unit budget.

## 2. Gate (`src/lib/routes/musd-btc-lp/gate.ts`)

`entryBlocker(input)` returns the first matching reason, or null. The message comes from spec §13 (existing outcomes where they exist):

| Reason | Condition | Message / recovery |
|---|---|---|
| `no-executor` | network has no executor | "Mainnet actions open after launch. Reading only." |
| `fee-mismatch` | on-chain `feeBps()` ≠ the pinned fee | "This MezoRoute deployment does not match the app. Reload the page." / Retry |
| `wrong-network` | wallet chain ≠ network | "MezoRoute executes on Mezo Testnet." / Switch network |
| `zero` | no amount | (button disabled, no message) |
| `insufficient-balance` | `musdIn > wallet MUSD` | "Amount exceeds your available MUSD." / Use Max |
| `above-cap` | `musdIn > maxMusdIn()` (read on chain) | existing `aboveCap` copy |
| `too-small` | no quote, `musdToSwap = 0`, `musdToSwap ≥ net`, `btcFromSwap = 0`, or `liquidity = 0` | "Amount is too small to route." |
| `price-impact` | price impact > 500 bps (5%) | "This trade would lose too much value at current liquidity." / Reduce amount |
| `needs-gas` | F2 readiness gas rule | "You need test BTC to submit transactions." / Open faucet |
| `quote-expired` | quote older than 60 s (confirm page) | "Pool state changed; refresh your quote." / Refresh quote |

## 3. Data (`src/lib/routes/musd-btc-lp/snapshot.ts`)

One multicall at one block: F2's `snapshotContracts` plus `PoolFactory.getFee(pool, false)`, MUSD `allowance(account, executor)`, MUSD `nonces(account)`, executor `feeBps()` and `maxMusdIn()`, and Multicall3 `getBlockNumber()` and `getCurrentBlockTimestamp()`. A hook `useLpRouteSnapshot(account)` adds the gas balance and gas price as F2 does, and refetches every 15 s. Each refetch yields a new quote stamped with its block and timestamp; the quote expires 60 s after its snapshot was fetched. The transaction and permit deadline is the snapshot's block timestamp + 600 s.

## 4. Pages

**`/route/lp?amount=&slippage=`**: `page.tsx` renders a client-only component (as `/` does).

- Amount input with **Max** (wallet MUSD); typing updates the URL with `history.replaceState`. Slippage presets 0.5 / 1.0 / 2.0% (default 1.0).
- "Deposit MUSD | Borrow & Deploy" toggle. Borrow & Deploy is disabled: for smart accounts "Borrow & Deploy needs a standard wallet signature."; otherwise "Borrow & Deploy is coming next."
- "What happens" in three steps (fee → swap about half to BTC → add both to the pool; leftovers return to you).
- Preview: estimated BTC from the swap, MUSD and BTC deposited, LP, minimum LP, MezoRoute fee (bps and MUSD), price impact, estimated gas.
- Exposure before → after (total BTC, LP BTC) and the drawdown table after entry, reusing F2's components.
- Risks, one sentence each: impermanent loss; double BTC exposure when the MUSD is borrowed against BTC; unaudited software.
- **Review** links to the confirm page with the same query; it is disabled while the gate returns a reason.

**`/route/lp/confirm?amount=&slippage=`**: shows the exact amounts, every minimum, the deadline, the quote age with a countdown, and "MezoRoute never holds your funds between transactions." Then the stepper (§5). Without a valid amount it redirects to `/route/lp`.

**`/tx/?hash=`**: see §6.

## 5. Stepper and sending

**Plan.** `entrySteps(kind, allowance, musdIn)`: `["permit", "enter"]` for an EOA, `["approve", "enter"]` for a smart account or an unknown kind, `["enter"]` when the allowance already covers `musdIn`.

**State machine** (`src/lib/tx/stepper.ts`, a pure reducer). Each step moves `idle → awaiting-wallet → (submitted → confirming) → done | failed`; signatures skip the transaction states. Events: `start`, `signed`, `submitted(hash)`, `confirmed`, `failed(DecodedError)`, `permit-expired`, and `reset(plan)` (before anything started). A failed step keeps its decoded error and the toast offers that error's recovery; `start` on a failed step retries that step only. The account and chain are pinned when the user starts the first step (`SendPin`), and every later step uses the pin.

**Permit** (`src/lib/routes/musd-btc-lp/permit.ts`): typed data `Permit(owner, spender = executor, value = musdIn, nonce, deadline)` with domain `{ name: "Mezo USD", version: "1", chainId, verifyingContract: MUSD }`, signed with wagmi `signTypedData` for the pinned account; the signature is split into `v, r, s`. If the permit's deadline passes before sending, the stepper returns to the permit step.

**Send `enter`:**
1. Refetch the snapshot and re-quote; stop on any gate reason.
2. Build `EnterParams` from the fresh quote (`recipient` = the pinned account) and the permit, or `NO_PERMIT`.
3. `simulateContract` from the pinned account. On a revert, show the decoded error and send nothing.
4. `submitCall` → hash → `router.push("/tx/?hash=…")`.

**Split of `sendCall`** (`src/lib/tx/send.ts`): `submitCall(config, call, pin)` returns the checked hash; `confirmCall(config, hash, chainId)` waits for the receipt with `onReplaced` (fails unless `reason === "repriced"`, F1 follow-up 1), then applies the existing revert, Safe `ExecutionFailure`, and timeout rules. `sendCall` = submit + confirm, used for the approval. A replaced transaction is a new error `TransactionReplacedError` → outcome "Your transaction was replaced in your wallet. Check it before trying again." with View transaction.

## 6. Receipt (`/tx/?hash=`)

- Validates the hash (32 bytes) and runs `confirmCall` on the selected network: **Submitted** (no receipt yet) → **Confirmed**.
- Values from `findEnteredEvent(receipt.logs, executor)` only: MUSD in, fee, MUSD swapped, BTC from the swap, MUSD and BTC deposited, LP received, MUSD and BTC returned. Also gas used, block number, and an explorer link (FR-13).
- On confirmation, all wagmi queries are invalidated so balances refresh (FR-02).
- A revert, a Safe `ExecutionFailure`, or a replacement shows the decoded error. A confirmation timeout shows the unconfirmed state with the explorer link and **no** retry. A transaction without an `Entered` event from the pinned executor shows "This transaction has no MezoRoute entry."
- CTA: **Back to dashboard** (Positions is F7).

## 7. Error decoder changes

- F1 follow-up 3: errors carrying a `TransactionRevertedError` are settled before the text rules; viem's `InsufficientFundsError` is matched by name.
- New outcomes: `replaced`, `fee-mismatch`, `price-impact` (kinds and messages as in §2 and §5). The executor and Router errors already map to §13 outcomes (`custom-errors.ts`).

## 8. Testing

**Vitest:**
- `quote`: the three S1 `Entered` events replayed exactly from on-chain reserves and supply at the previous block (fixtures recorded with `cast`); the optimal swap leaves at most a dust residue over a grid of amounts and reserves, with both token orders; minimums, price impact, `applyEntry`, gas estimate.
- `gate`: each reason, in order.
- `permit`: the typed-data domain hashes to the on-chain `DOMAIN_SEPARATOR`; signature splitting.
- `stepper`: plans for each wallet kind and allowance; every transition, retry, and permit expiry.
- `send`: `onReplaced` (repriced passes; cancelled and replaced fail).
- `decodeError`: the F1 follow-up-3 cases and the new outcomes.

**QA run by me** (local static export + Playwright, as for F2): a mock EIP-1193 wallet that **signs for real** with the testnet key in `contracts/.env`. Signing runs in the Playwright (Node) process through `page.exposeFunction`; the key is never printed and never enters the page. The run covers permit → `enter` → receipt on live testnet, a check that the quote matches the `Entered` event, quote expiry (RPC blocked for over 60 s), and the 360 px layout. Slippage reverts are covered by the decoder's unit tests: a live pool cannot be moved on demand between the quote and the send.

**QA run by the user** on the Vercel preview: Unisat through Passport (approve → `enter` through the relayer → receipt), and MetaMask (permit → `enter`).

## Done when

- `cd web && npm test && npm run build` pass; `cd contracts && forge test` still passes.
- The QA runs above pass on testnet, and a live `Entered` event matches its quote.
- `PRODUCT_SPEC.md`: §12 has the corrected optimal-swap formula; §14 says quote maths is checked against replayed live `Entered` events; §16 records F3 as done.
- `CLAUDE.md` frontend notes cover the URL-intent pattern, the permit domain, and the submit/confirm split.
- The F1 design doc marks follow-ups 1 and 3 as closed.

### QA result (12 Oct 2026): passed

- **Agent, local export + Playwright:** route page, confirm page, receipt, wallet rejection, malformed hash (no RPC call), quote expiry with the RPC blocked for 66 s, 360 px layout, mainnet read-only. Live permit → `enter` from the deployer EOA through a local signer: tx `0xa0277e8f019f38e437d7fc603b56f2eac2274a04c241f391189927110cd3195c` (5 MUSD); the quote at the previous block matches the `Entered` event to the wei; allowance 0 and executor MUSD/BTC/LP balances 0 afterwards.
- **User, Vercel preview:** Unisat through Passport, approve → `enter` relayed to Safe `0x4543…e22D`: tx `0xc22fffc77896a5c464da516a692c8eab491e63467378c18acb3a71f5906d1083` (`ExecutionSuccess`, `Entered` caller and recipient the Safe, allowance 0, executor balances 0). EVM wallet with a permit: tx `0x2c65551e30410a6445cf1e7e6a4c06463bbd2981c46175e24285b18d5df0e268`. Reload keeps the Unisat connection.
- **Bugs found and fixed during QA:** viem's `multicall3Abi` lacks `getBlockNumber` (own ABI); `confirmCall` gave up when the testnet RPC returned a null receipt or block for a mined transaction (now retries within 120 s); every navigation re-rendered `WagmiProvider`, whose `Hydrate` reconnects on render, which logged Unisat out between Review and Approve; OrangeKit rejected wagmi's reconnect (no `chainId`) and skipped a wallet that injects late, so Bitcoin wallets were logged out on reload.

## Out of scope

- LP exit, positions, cost basis, fee claims (F7).
- Borrow & Deploy (F4) and the Stability Pool route (F5).
- Route comparison and the amount input on the dashboard (F6).
- F1 follow-ups 4 (rejected network switch message) and 5 (storage write failure on network switch).
