# MezoRoute contracts

`MezoRouteExecutor` — non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
See `../PRODUCT_SPEC.md` Section 11 for the specification.

## Build and test

    forge build
    forge test

Deploy and smoke-test on testnet (copy `.env.example` to `.env` first):

    set -a && source .env && set +a
    forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --private-key "$PRIVATE_KEY"
    ./script/smoke-testnet.sh

Tests run against the real Tigris Pool/PoolFactory/Router source (commit `0a3b5e8`) deployed
locally with mock MUSD/BTC. Mezo's BTC token is a chain precompile, so fork tests are not possible;
`script/smoke-testnet.sh` exercises the deployed contract on Mezo testnet instead.

## Deployments

| Network | Address | Fee |
|---|---|---|
| Mezo testnet (31611) | [`0x10E6334d2716FDE5f2bEb418C66fD7C9c1021fB9`](https://explorer.test.mezo.org/address/0x10E6334d2716FDE5f2bEb418C66fD7C9c1021fB9) (verified, current) | 10 bps |
| Mezo testnet (31611) | [`0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e`](https://explorer.test.mezo.org/address/0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e) (superseded: lacked the recipient guard) | 10 bps |

## Live smoke test (30 Sep 2026, Mezo testnet, executor `0x10E6…1fB9`)

`script/smoke-testnet.sh` (reads `contracts/.env`) ran enter → exit → borrowAndEnter; all transactions succeeded and executor balances were `[0 0 0]` before and after.

| Flow | Transaction |
|---|---|
| enter 20 MUSD | [0x9c23…bba0](https://explorer.test.mezo.org/tx/0x9c23cea92ff3331c3ac8e06946249144042b042179d8879746c09ed53759bba0) |
| exit all LP | [0x56cf…7c74](https://explorer.test.mezo.org/tx/0x56cfec155eae97f47bc07179d1159ed8e28f312b4a440e0061ee296c665c7c74) |
| borrowAndEnter 20 MUSD | [0x5da3…acd5](https://explorer.test.mezo.org/tx/0x5da3e34cf888d56c127eb4a6d354e579a43b5b2119b6810af9be599bb9ddacd5) |

Earlier run on the superseded executor measured: fee exactly 0.02 MUSD per 20 MUSD entry, round trip 40 → 39.936 MUSD (0.16% incl. 0.1% fee), and exactly 20 MUSD minted to the borrower in borrowAndEnter.

## Development timeline

Contract development started on 30 Sep 2026, during the hackathon's pre-registration period (Wave 1 build period: 16–26 Oct 2026).

## Limitations

- `borrowAndEnter` supports EOA signers only (MUSD verifies with `ECDSA.recover`).
- No gauge staking or MEZO rewards: no MEZO-paying gauge exists for this pool.
- Unaudited. Mainnet deployment (Wave 2) adds an immutable per-transaction cap.
