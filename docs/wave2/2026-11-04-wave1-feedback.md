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

Not checked yet: who holds the Stability Pool and sMUSD balances, and whether borrowing moved elsewhere (reviews cite Mezo's own Morpho Blue; the explorer lists other `BorrowerOperationsSignatures` contracts).

## Claims that may be stale

`PRODUCT_SPEC.md` §1 and §4 and the Wave 1 submission say veMEZO is not deployed and no gauge pays MEZO (research from 30 Sep). The mainnet explorer now lists veMEZO `0xb90f…0122` and a wrapped veMEZO `0x089A…67C8` with 1.57M supply, and reviews describe gauge staking and MEZO rewards. Re-scan before repeating these claims to the Mezo team.

The deck's "Stability Pool holds 48% of MUSD" is correct but says nothing about who holds it. With 18.6k MUSD of Trove debt, liquidation returns to a 14.17M pool are small; check before pitching that route as a yield source.
