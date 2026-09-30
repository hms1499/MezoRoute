#!/usr/bin/env bash
# Live Mezo testnet smoke test for a deployed MezoRouteExecutor.
# Mezo's BTC token is backed by a chain precompile, so this cannot run on a local fork;
# every call goes to the real testnet through `cast`.
#
# Required env:
#   PRIVATE_KEY  key holding test BTC for gas and at least AMOUNT MUSD
#   EXECUTOR     deployed MezoRouteExecutor address
# Optional env:
#   AMOUNT       MUSD in wei (default 20 MUSD)
#   BORROW=1     also run borrowAndEnter (the key must own an open Trove with headroom)
set -euo pipefail

RPC=${RPC:-https://rpc.test.mezo.org}
EXPLORER=https://explorer.test.mezo.org/tx
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
BTC=0x7b7C000000000000000000000000000000000000
ROUTER=0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9
FACTORY=0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A
POOL=0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9
BOS=0xD757e3646AF370b15f32EB557F0F8380Df7D639e
ZERO32=0x0000000000000000000000000000000000000000000000000000000000000000
NO_PERMIT="(0,0,0,$ZERO32,$ZERO32)"
ENTER_SIG="enter((uint256,uint256,uint256,uint256,uint256,uint256,uint256,address),(uint256,uint256,uint8,bytes32,bytes32))"
EXIT_SIG="exit((uint256,uint256,uint256,uint256,uint256,uint256,address),(uint256,uint256,uint8,bytes32,bytes32))"
BORROW_SIG="borrowAndEnter((uint256,address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,address))"

: "${PRIVATE_KEY:?set PRIVATE_KEY}"
: "${EXECUTOR:?set EXECUTOR}"
AMOUNT=${AMOUNT:-20000000000000000000}
ME=$(cast wallet address "$PRIVATE_KEY")

calc() { python3 -c "print(int($1))"; }
first() { awk '{print $1}'; }
# The public testnet RPC intermittently returns null for receipts, so submit asynchronously
# and poll for the receipt; fail if the transaction reverted.
send() {
  local hash status i
  hash=$(cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --async)
  echo "  $EXPLORER/$hash" >&2
  for i in $(seq 1 30); do
    status=$(cast receipt "$hash" status --rpc-url "$RPC" 2>/dev/null | first || true)
    if [[ -n "$status" ]]; then
      [[ "$status" == "1" ]] || { echo "  reverted: $hash" >&2; exit 1; }
      echo "$hash"
      return
    fi
    sleep 2
  done
  echo "  no receipt after 60s: $hash" >&2
  exit 1
}
quote_swap() { # from to amountIn -> amountOut
  cast call "$ROUTER" "getAmountsOut(uint256,(address,address,bool,address)[])(uint256[])" "$3" "[($1,$2,false,$FACTORY)]" --rpc-url "$RPC" \
    | python3 -c "import sys,re; print(re.findall(r'\d+', sys.stdin.read().split(',')[1])[0])"
}
enter_params() { # amount recipient -> tuple
  local fee net swap btc_out
  fee=$(cast call "$EXECUTOR" "feeBps()(uint256)" --rpc-url "$RPC" | first)
  net=$(calc "$1 - $1 * $fee // 10000")
  swap=$(calc "$net // 2")
  btc_out=$(quote_swap "$MUSD" "$BTC" "$swap")
  echo "($1,$swap,$(calc "$btc_out * 99 // 100"),0,0,0,$(( $(date +%s) + 600 )),$2)"
}

executor_balances() {
  echo "$(cast call "$MUSD" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)" \
    "$(cast call "$BTC" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)" \
    "$(cast call "$POOL" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)"
}
BEFORE=$(executor_balances)

echo "== enter $AMOUNT MUSD as $ME"
send "$MUSD" "approve(address,uint256)" "$EXECUTOR" "$AMOUNT" >/dev/null
send "$EXECUTOR" "$ENTER_SIG" "$(enter_params "$AMOUNT" "$ME")" "$NO_PERMIT" >/dev/null

echo "== exit all LP"
LP=$(cast call "$POOL" "balanceOf(address)(uint256)" "$ME" --rpc-url "$RPC" | first)
read -r MUSD_R BTC_R < <(cast call "$ROUTER" "quoteRemoveLiquidity(address,address,bool,address,uint256)(uint256,uint256)" \
  "$MUSD" "$BTC" false "$FACTORY" "$LP" --rpc-url "$RPC" | first | paste -sd' ' -)
SWAP_OUT=$(quote_swap "$BTC" "$MUSD" "$BTC_R")
MIN_OUT=$(calc "($MUSD_R + $SWAP_OUT) * 99 // 100")
send "$POOL" "approve(address,uint256)" "$EXECUTOR" "$LP" >/dev/null
send "$EXECUTOR" "$EXIT_SIG" "($LP,0,0,0,$MIN_OUT,$(( $(date +%s) + 600 )),$ME)" "$NO_PERMIT" >/dev/null

if [[ "${BORROW:-0}" == "1" ]]; then
  echo "== borrowAndEnter $AMOUNT MUSD"
  NONCE=$(cast call "$BOS" "getNonce(address)(uint256)" "$ME" --rpc-url "$RPC" | first)
  DEADLINE=$(( $(date +%s) + 600 ))
  TYPED=$(mktemp)
  cat > "$TYPED" <<JSON
{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],
"WithdrawMUSD":[{"name":"amount","type":"uint256"},{"name":"borrower","type":"address"},{"name":"recipient","type":"address"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]},
"primaryType":"WithdrawMUSD","domain":{"name":"BorrowerOperationsSignatures","version":"1","chainId":31611,"verifyingContract":"$BOS"},
"message":{"amount":"$AMOUNT","borrower":"$ME","recipient":"$ME","nonce":"$NONCE","deadline":"$DEADLINE"}}
JSON
  SIG=$(cast wallet sign --private-key "$PRIVATE_KEY" --data --from-file "$TYPED")
  rm -f "$TYPED"
  send "$MUSD" "approve(address,uint256)" "$EXECUTOR" "$AMOUNT" >/dev/null
  send "$EXECUTOR" "$BORROW_SIG" "($AMOUNT,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,$SIG,$DEADLINE)" "$NO_PERMIT" "$(enter_params "$AMOUNT" "$ME")" >/dev/null
fi

AFTER=$(executor_balances)
echo "== executor balances MUSD BTC LP: before [$BEFORE] after [$AFTER]"
if [[ "$BEFORE" != "$AFTER" ]]; then
  echo "FAIL: executor balances changed during the run" >&2
  exit 1
fi
echo "PASS: executor balances unchanged"
