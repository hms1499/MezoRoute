## What it does

MezoRoute helps Mezo borrowers decide where their MUSD should go, gets it there in one transaction, and manages the Trove behind it.

- **Compare routes:** for the same amount, it shows the MUSD/BTC LP and the Stability Pool side by side. It covers the return source (swap fees, gauge MEZO, or liquidation BTC), what the last 30 days paid on chain, and each route's effect on the user's BTC exposure next to their Trove's collateral ratio. It works before a wallet is connected.
- **Borrow & Deploy:** borrow against the Trove, enter the MUSD/BTC pool and stake the LP in the gauge in one transaction, with an exact quote and slippage limits.
- **Enter from BTC:** BTC in, with no MUSD needed first.
- **Unwind, Close, Leverage:** one transaction on the user's own Trove, using a flash swap on the pool. Unwind sells collateral to repay debt, Close repays everything from collateral, and Leverage adds BTC paid for by new debt. Each page shows the cost against Mezo's oracle and the user's place in the redemption queue.
- **Positions:** value, cost basis, pool fees, pending MEZO and Stability Pool BTC gains. Exit, claim, stake and unstake each take one click.

It works with EVM wallets and with Bitcoin wallets through Mezo Passport. It is live on mainnet with verified contracts, capped per transaction.

## The problem it solves

In the Mezo app, going from borrowing to an LP position takes 6 wallet confirmations on 3 screens, and leaves BTC dust behind. Lowering a Trove's risk needs MUSD the borrower may have already deployed.

The bigger problem is the decision. A borrower's Trove is already exposed to BTC. Putting the MUSD into the MUSD/BTC LP adds more BTC exposure, while the Stability Pool pays in BTC from liquidations. Nothing showed borrowers how either choice changes their own risk. MezoRoute makes that visible, executes the chosen route safely, and gives a one-transaction way back out.

## Challenges I ran into

- **No fork testing.** Mezo's BTC is a chain precompile, so even `balanceOf` reverts on an anvil fork. We test against the real Tigris Pool, Router and Gauge in a local harness, with a BTC mock that mirrors native-balance accounting. A smoke script checks behaviour against Mezo testnet.
- **Exact quotes.** The frontend mirrors the pool's rounding exactly. Replaying every live entry matches to the wei, and the mainnet entries landed with 0 bps quote error.
- **Flash swaps on a user's Trove.** The Leverage contract acts through Mezo's signed Trove adjustment, with the caller always the borrower and the recipient. Every swap is bounded by Mezo's `PriceFeed`, and every call ends with the contract's balances unchanged.
- **Bitcoin wallets act through an OrangeKit smart account.** That means no typed-data signatures, relays that report success while the inner call reverts, and relayer outages that happen before any hash exists. Passport hardcoded a dead relayer URL, so we patch it at build time.
- **Unreliable RPC.** Testnet returned null receipts and bare gas estimates. We added receipt polling with an explorer fallback and gas budgets measured from real transactions, since Mezo charges at least half the gas limit.
- **Honest returns.** The Stability Pool backtest uses Liquity's maths, checked to the wei and never annualised. MEZO rates are shown as this week's rate.

## Technologies I used

- **Contracts:** Solidity 0.8.24 (London EVM), Foundry, OpenZeppelin 4.9
- **Mezo integration:** MUSD `BorrowerOperationsSignatures` (EIP-712 borrowing and Trove adjustment), `TroveManager`, `PriceFeed`; the Tigris MUSD/BTC pool (including flash swaps), router and MEZO gauge; the Stability Pool
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Wallets and chain access:** wagmi 2, viem 2, RainbowKit, Mezo Passport, OrangeKit, Blockscout API
- **Testing:** Foundry (314 tests), Vitest (1,663 tests), Playwright with a mock EIP-1193 wallet
- **Hosting:** Vercel

## How we built it

We started with a written spec covering scope, addresses and security invariants. Each feature then went through design, spec, plan and test-driven implementation.

Both contracts are stateless, with no owner, admin or proxy. Every payout is a balance change measured inside the call, approvals reset to zero, and borrowed MUSD and staked LP always go to the caller. A self-audit maps every invariant to its tests.

We tested on testnet, then deployed capped, source-verified contracts on mainnet. We ran real round trips through the production UI:

- Stability Pool deposit and withdrawal;
- LP enter with stake, claim MEZO, and exit;
- entry from BTC;
- on testnet, a full Trove cycle: leverage, unwind, close.

The contracts held nothing afterwards.

## What we learned

- Mezo is EVM-compatible but not EVM-identical. BTC as a precompile, London-only opcodes and the gas charging rule all shaped the design.
- Bitcoin wallets on an EVM chain need their own failure model.
- Users need to see a route's risk before its yield, so oracle cost and redemption-queue position come first on every Trove action.
- Integrate MEZO when it is real. In Wave 1 no gauge paid MEZO, so we went deep on MUSD. Once the gauge paid, we added staking in the same transaction.

## What's next for MezoRoute

1. A real Unwind, Close and Leverage round trip on mainnet.
2. Borrow & Deploy and Trove actions for Bitcoin wallets, and opening a Trove in the same flow.
3. An external audit before raising the caps, and a public stats page built from executor events.
