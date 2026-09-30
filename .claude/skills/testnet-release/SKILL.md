---
name: testnet-release
description: Test, deploy, verify, and live-smoke-test MezoRouteExecutor on Mezo testnet, then record the new address. Use when the user asks to redeploy the executor to testnet.
disable-model-invocation: true
---

Release the current `contracts/` build to Mezo testnet (chain 31611). Arguments: $ARGUMENTS (optional, e.g. `BORROW=0` to skip the borrow smoke step).

Never print `PRIVATE_KEY` or echo `.env` contents. Load env with `set -a && source contracts/.env && set +a` inside each command.

1. **Preflight**
   - `contracts/.env` exists with `PRIVATE_KEY`, `FEE_RECIPIENT`, `FEE_BPS`; stop and ask the user if not.
   - Print only the wallet address (`cast wallet address "$PRIVATE_KEY"`), its BTC gas balance, MUSD balance, and Trove status (`TroveManager 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 getTroveStatus`). Need ≥ 0.005 BTC and ≥ `AMOUNT` MUSD; if `BORROW=1` the Trove status must be 1.
   - `cd contracts && forge fmt --check && forge test` — stop on any failure.

2. **Deploy**
   `forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --private-key "$PRIVATE_KEY"`; capture the `MezoRouteExecutor 0x…` address from the output.

3. **Verify** on Blockscout:
   `forge verify-contract <addr> src/MezoRouteExecutor.sol:MezoRouteExecutor --chain 31611 --verifier blockscout --verifier-url https://api.explorer.test.mezo.org/api --constructor-args $(cast abi-encode "<constructor signature from src/MezoRouteExecutor.sol>" <testnet addresses from script/Deploy.s.sol> $FEE_BPS $FEE_RECIPIENT …) --watch`
   Build the constructor args from the current constructor and `Deploy.addressesFor(31611)` — do not assume the argument list is unchanged.

4. **Record**: set `EXECUTOR=<addr>` in `contracts/.env` (sed in place), then run the smoke test:
   `./script/smoke-testnet.sh` from `contracts/` (it reads `.env`; pass through any `$ARGUMENTS` overrides). It must end with `PASS: executor balances unchanged`.

5. **Decode** the `Entered`/`Exited` events of the smoke transactions (`cast receipt <hash> --json`) and report fee, musdIn, liquidityOut, musdOut, and gas used.

6. **Update docs**: in `contracts/README.md` mark the previous testnet address as superseded and add the new one with explorer links and the smoke transactions; update the MezoRouteExecutor row in `PRODUCT_SPEC.md` Section 11.1. Commit on the current branch (`chore(contracts): redeploy testnet executor`). Do not push.

7. **Report** to the user: new address, verification status, smoke result, explorer links, and anything that failed.
