# Wave 1 feedback and Wave 2 inputs

Collected 4 Nov 2026 from AKINDO's public API (`/public/products/<id>/wave-submissions`, `/public/wave-hacks/OVOO0gdrVU8379D10`) and Mezo mainnet reads. Inputs for the Wave 2 design, not an approved scope.

## Deadline conflict

The buildathon page says Wave 2 runs 2–15 Nov (judging 16–22 Nov). The platform's wave record says `submissionDeadline: 2026-11-13T05:30:06Z` (13 Nov, 12:30 Vietnam time). Plan for 13 Nov until AKINDO or Mezo confirms otherwise.

## MezoRoute's result

$20 of the $1,800 paid out (135 reviewed, 34 at $0; tied 7th–10th by amount).

| Criterion | Weight | Score |
|---|---:|---:|
| Mezo Integration | 30% | 8 |
| Product & Business Viability | 30% | 8 |
| Technical Implementation | 20% | 8 |
| User Experience | 10% | 8 |
| Submission Materials | 10% | 6 |

Weighted 7.8/10. Judge review (`civ_defi_mezo`, 30 Oct), verbatim:

> MezoRoute already composes Mezo primitives on mainnet (Tigris LP via a verified executor, Stability Pool, signed Trove borrowing), so the next integration step is to run Borrow & Deploy on mainnet and add the planned leverage and unwind with redemption-risk handling, which would move it toward a new MUSD use rather than a router over existing ones. Getting real third-party users through the executor, beyond the team's QA wallet, would strengthen both the integration and the business case for the 10 bps fee. Keep the demo video under 2:15, since the 178-second cut caps Materials, and show the Borrow & Deploy flow clearly in it.

Payouts do not follow the visible scores: Doji and mbLP both scored 10/8/8/8/8 and received $80 and $22; Janus, Keel and Mezonk scored 8/8/8/8/2 and received $69. The cause is unknown, so do not optimise for it.

## The integration ladder (inferred from all 135 reviews)

The ladder is not published. Reviews name its levels, and the score equals level × 2 (checked on seven reviews).

| Level | Score | Meaning |
|---|---:|---|
| 1 | 2 | Cosmetic; "earns no payout" |
| 2 | 4 | Plain ERC-20; "swapping in USDC would change nothing" |
| 3 | 6 | Protocol-aware: reads Mezo state |
| 4 | 8 | Composes: acts on Mezo primitives, proven on-chain |
| 5 | 10 | New MUSD use or demand, exercised on-chain, under stress and with outside users |

MezoRoute is level 4. Only four projects reached 10 (Doji, mbLP, Baserate, Deed).

## What reviews repeat

Reviews mentioning each theme, out of 135 (keyword counts, approximate): revenue or sustainability 73, level or ladder 66, explorer verification 48, outside users 42, redemptions 32, Recovery Mode 27, idle or productive reserves 17, sMUSD 14, gauges 14.

A missing deck caps Materials at 1 level; a video over 2:15 also caps it.

## What leverage competitors were marked down for

Pylon, Coil (two projects) and Mezodot already ship one-transaction leverage. The reviews list what a credible version must handle:

- `maxBorrowingCapacity` (check it or refinance before looping)
- Recovery Mode: a way out, and no withdrawal assumption under 150% TCR
- Pending redistribution debt: `getEntireDebtAndColl` already folds it in, so do not add it twice
- `claimCollateral` after a redemption, so surplus BTC is not stranded
- Swap minimums from `PriceFeed`, not the pool's spot quote (sandwich risk)
- Any admin path over user funds (Pylon lost points for an un-timelocked setter)
- Explorer verification and real wallets beyond the deployer

## Mainnet state (block 12,994,660, 4 Nov)

| Fact | Value |
|---|---|
| Executor transactions | 7: the deploy plus 6 from the team's wallet `0x375a…`; **no third party** |
| Troves in our `TroveManager` | **3**, about 18.6k MUSD of debt (8 Troves on 15 Oct) |
| MUSD supply and holders | 29.49M, 29,240 holders |
| Stability Pool | 14.17M MUSD |
| sMUSD (`0xb4D4…51CC`) | 6.48M supply; not in the app |
| MUSD/BTC basic pool | 58.3k MUSD + 0.74 BTC |
| BTC price (`PriceFeed`) | 78,198 MUSD |

## Mezo re-scan (4 Nov, supersedes the 30 Sep research)

Sources: mainnet reads at about block 12,995,000 (`cast`, archive `eth_call`), the explorer API, mezo.org/earn, CoinGecko, DefiLlama. Past blocks are estimated at 23,500 blocks a day. Lines marked *inference* are not stated by any source.

### The Trove market has almost gone

| Days back | Troves | Debt (MUSD) | Collateral (BTC) |
|---:|---:|---:|---:|
| 200 | 59 | 5.67M | 310 |
| 150 | 55 | 3.92M | 100 |
| 90 | 29 | 1.60M | 57 |
| 30 | 15 | 757k | 38 |
| 20 | 8 | 406k | 26 |
| 10 | 1 | 14.5k | 16.6 |
| 0 | 3 | 18.6k | 16.7 |

- MUSD trades at about $0.99 (CoinGecko $0.9897, mezo.org vault page $0.9907), steadily over the last 7 days.
- The 50 latest direct `TroveManager` transactions are all `redeemCollateral` (latest 28 Oct); recent `BorrowerOperations` calls are mostly `claimCollateral` and short open/close pairs.
- *Inference:* buying MUSD at $0.99 and redeeming at $1 is a standing arbitrage, and it is emptying the Trove book, lowest collateral ratio first.
- Two of the three Troves sit at about 116% and 135%. One holds 16.59 BTC against 14.5k MUSD.

### Where the MUSD is

| Holder | MUSD | What it is |
|---|---:|---|
| Stability Pool | 14.17M | All of it is the PCV's bootstrap deposit (`getCompoundedMUSDDeposit(PCV)` equals the pool; PCV `debtToPay` 14.95M) |
| sMUSD `IdleStrategy` | 6.48M | 5.25M staked in the gauge by `Enclave`, 1.1M in a Safe, about 130k for everyone else |
| mUSDC/MUSD CL pool | 5.26M | Against only 25k mUSDC, so the pool is one-sided |
| Wormhole `NttManager` | 2.49M | Locked for other chains; Ethereum shows 1.66M MUSD and 7,766 holders |
| Safe `0xf365…` | 0.53M | |
| Everything else on Mezo | about 350k | Includes all user wallets; EOAs in the top 300 hold 163k (one holds 68k; 24 hold at least 1,000) |

`Enclave` (`0x4da9…`, deployed by Mezo's deployer) received 10.5M MUSD mints (2.625M + 7.875M) and holds 250 BTC. *Inference:* most non-bootstrap MUSD is protocol-seeded liquidity, not user money.

Every transaction sent directly to the Stability Pool since its deployment is from our own wallet, apart from its setup. Relayed calls would not appear in that list.

### Where the yield is (mezo.org/earn, 4 Nov)

| Place | TVL | Fee APR | MEZO APR |
|---|---:|---:|---:|
| BTC/MUSD basic (MezoRoute's pool) | $115.9k | 1.7% | **94.1%** when staked |
| BTC/MUSD-200 concentrated | $35.1k | 60.0% | 412.4% |
| MEZO/MUSD-200 concentrated | $7.7k | 111.0% | 596.9% |
| mUSDC/MUSD-10 concentrated | $5.24M | 0.2% | 2.0% |
| MUSD Savings Vault (sMUSD) | $6.47M | 0.03% | 1.6% |
| Stability Pool | | No fees; pays only from liquidations on 18.6k of debt | |

`PoolGauge` for our pool (`0x8Be2…9AaF`) pays MEZO at 0.481 MEZO/s, with 82.5% of LP tokens staked. At MEZO $0.00594 that is 94.2% on the staked value, which matches the app. It is about $90k a year in total, resets weekly with veBTC votes, and dilutes as deposits arrive. Staked LP gives up swap fees to voters.

MezoRoute's LP route does not stake, so its users earn the 1.7%. The Compare card shows neither emissions nor the sMUSD vault.

### Where the capital and activity are

- veBTC (`0x3D4b…`) holds 804 of the 1,116 BTC on Mezo, with 1,793 holders. veMEZO has 1,400.
- The pools `Voter` (`0x4823…`) has 28,082 transactions; its latest 50 span five days from 20 senders (`claimRewards`, `claimFeesAndBribes`, `vote`).
- *Inference:* this may be why four of the five top Wave 1 payouts (Doji, Surety, Janus, Keel) are veBTC products.

### What this breaks in our materials

- `PRODUCT_SPEC.md` §1 and §4, and the submission's "No gauge pays MEZO and veMEZO is not deployed": false on mainnet today. Our own pool has a MEZO gauge.
- The deck's "Stability Pool holds 48% of MUSD": true, but the deposit is the protocol's own loan, so it is not evidence of user demand.

## Proposal (awaiting user approval)

1. **Gauge route:** enter the LP and stake in one transaction, claim MEZO, unstake and exit. Compare shows fees and emissions separately, with dilution and MEZO price risk stated.
2. **Enter from BTC**, so veBTC-adjacent and BTC holders need no MUSD first.
3. **Unwind, then Leverage:** testnet plus a small mainnet cap, with redemption handling. This is what the judge named, but mainnet demand today is close to nil, so it is not the lead.
4. **Outside users and a public stats page**, then a video under 2:15 and a corrected deck.

Dropped from the earlier draft: a sMUSD deposit route (0.03% plus 1.6%, with little user money there). Show it in Compare only.
