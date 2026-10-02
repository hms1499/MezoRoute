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
| Mezo testnet (31611) | [`0xB36B2E012003840951CFf00fA6b1E3237A110920`](https://explorer.test.mezo.org/address/0xB36B2E012003840951CFf00fA6b1E3237A110920) (verified, current; cap 1,000,000 MUSD) | 10 bps |
| Mezo testnet (31611) | [`0x10E6334d2716FDE5f2bEb418C66fD7C9c1021fB9`](https://explorer.test.mezo.org/address/0x10E6334d2716FDE5f2bEb418C66fD7C9c1021fB9) (superseded: no per-transaction cap or default-factory check) | 10 bps |
| Mezo testnet (31611) | [`0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e`](https://explorer.test.mezo.org/address/0x5AA6A335eFC1211f0D9554504C5C7B14c220c39e) (superseded: lacked the recipient guard) | 10 bps |

## Live smoke test (2 Oct 2026, Mezo testnet, executor `0xB36B…0920`)

`script/smoke-testnet.sh` (reads `contracts/.env`, `BORROW=1`) checked that an entry of cap + 1 reverts with `AmountAboveCap` (`eth_call`), then ran enter → exit → borrowAndEnter; all transactions succeeded and executor balances were `[0 0 0]` before and after. Values are decoded from the executor events.

| Flow | Transaction | Event values | Gas |
|---|---|---|---|
| enter 20 MUSD | [0x5f17…87bf](https://explorer.test.mezo.org/tx/0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf) | fee 0.02, swapped 9.99, LP 0.035582, MUSD refund 0.003995 | 403,957 |
| exit all LP | [0x38a4…7e30](https://explorer.test.mezo.org/tx/0x38a45ffe6b97b99ce6b5207c90878b02f969e35d30c1caa914425c04e9b17e30) | LP in 0.071164 (this entry plus the LP left by the previous run's borrowAndEnter), MUSD out 39.936014 | 350,049 |
| borrowAndEnter 20 MUSD | [0xdebe…6259](https://explorer.test.mezo.org/tx/0xdebe600d007658ae648a131d68d136d6d8b2b915d96c6f6fcd11480febdc6259) | borrowed 20, fee 0.02, LP 0.035582 | 2,178,863 |

Earlier runs on superseded executors measured: fee exactly 0.02 MUSD per 20 MUSD entry, round trip 40 → 39.936 MUSD (0.16% incl. 0.1% fee), and exactly 20 MUSD minted to the borrower in borrowAndEnter.

## Development timeline

Contract development started on 30 Sep 2026, during the hackathon's pre-registration period (Wave 1 build period: 16–26 Oct 2026).

## Limitations

- `borrowAndEnter` supports EOA signers only (MUSD verifies with `ECDSA.recover`).
- No gauge staking or MEZO rewards: no MEZO-paying gauge exists for this pool.
- Unaudited (see the self-audit checklist in `SELF_AUDIT.md`). Entries are limited by an immutable per-transaction cap: 1,000 MUSD on mainnet, 1,000,000 MUSD on testnet. Exits are never capped.
