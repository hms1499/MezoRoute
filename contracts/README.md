# MezoRoute contracts

`MezoRouteExecutor` — non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
See `../PRODUCT_SPEC.md` Section 11 for the specification.

## Build and test

    forge build
    forge test

Tests run against the real Tigris Pool/PoolFactory/Router source (commit `0a3b5e8`) deployed
locally with mock MUSD/BTC. Mezo's BTC token is a chain precompile, so fork tests are not possible;
`script/smoke-testnet.sh` exercises the deployed contract on Mezo testnet instead.

## Deployments

| Network | Address | Fee |
|---|---|---|
| Mezo testnet (31611) | [`0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e`](https://explorer.test.mezo.org/address/0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e) (verified) | 10 bps |

## Live smoke test (30 Sep 2026, Mezo testnet)

| Flow | Transaction | Result |
|---|---|---|
| enter 20 MUSD | [0xc993…617d](https://explorer.test.mezo.org/tx/0xc993a9b80df305459ed2aaf83971d3abcfdc086a66e3c5124f4aa6cd14dc617d) | fee 0.02 MUSD, residue 0.004 MUSD refunded |
| exit all LP | [0x331f…8e41](https://explorer.test.mezo.org/tx/0x331fe8cc9dbdd500931d657fe74045b584545e75a40d4040b8ee6da7085e8e41) | 40 MUSD in → 39.936 MUSD out (0.16% incl. 0.1% fee) |
| borrowAndEnter 20 MUSD | [0xb0eb…a762](https://explorer.test.mezo.org/tx/0xb0eb340bec12f6b248f899f15dd553a4d354f2b12722dddc3fe689258ed1a762) | exactly 20 MUSD minted to the borrower; executor balances unchanged |

## Development timeline

Contract development started on 30 Sep 2026, during the hackathon's pre-registration period (Wave 1 build period: 16–26 Oct 2026).

## Limitations

- `borrowAndEnter` supports EOA signers only (MUSD verifies with `ECDSA.recover`).
- No gauge staking or MEZO rewards: no MEZO-paying gauge exists for this pool.
- Unaudited. Mainnet deployment (Wave 2) adds an immutable per-transaction cap.
