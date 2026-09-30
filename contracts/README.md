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
| Mezo testnet (31611) | Not yet deployed — see `script/Deploy.s.sol` | 10 bps |

## Development timeline

Contract development started on 30 Sep 2026, during the hackathon's pre-registration period (Wave 1 build period: 16–26 Oct 2026).

## Limitations

- `borrowAndEnter` supports EOA signers only (MUSD verifies with `ECDSA.recover`).
- No gauge staking or MEZO rewards: no MEZO-paying gauge exists for this pool.
- Unaudited. Mainnet deployment (Wave 2) adds an immutable per-transaction cap.
