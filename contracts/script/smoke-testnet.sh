#!/usr/bin/env bash
# Live Mezo testnet smoke test for a deployed MezoRouteExecutorV2.
# Mezo's BTC token is backed by a chain precompile, so this cannot run on a local fork;
# every call goes to the real testnet through `cast`. It also exercises the unverified testnet
# gauge (deposit, earned, getReward, withdraw) and checks the BTC token's EIP-2612 domain.
#
# Required env:
#   PRIVATE_KEY  key holding test BTC for gas and at least AMOUNT MUSD and BTC_AMOUNT BTC
#   EXECUTOR     deployed MezoRouteExecutorV2 address
# Optional env:
#   AMOUNT       MUSD in wei for the MUSD entries (default 20 MUSD)
#   BTC_AMOUNT   BTC in wei for the BTC entries (default 0.0003 BTC)
#   GAS_MULT     gas limit = estimate x GAS_MULT (default 2; the testnet RPC has under-estimated once).
#                Mezo charges at least half the limit, so gasUsed is floor-inflated above ~1.4; use GAS_MULT=1.3 to measure.
#   WAIT         seconds to let the gauge accrue rewards (default 60)
#   BORROW=1     also run borrowAndEnter (the key must own an open Trove with headroom)
set -euo pipefail

RPC=${RPC:-https://rpc.test.mezo.org}
EXPLORER=https://explorer.test.mezo.org/tx
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
BTC=0x7b7C000000000000000000000000000000000000
ROUTER=0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9
FACTORY=0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A
POOL=0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9
GAUGE=0x72D88B0795373437E86792DEd8362D66dC43Cd2c
BOS=0xD757e3646AF370b15f32EB557F0F8380Df7D639e
ZERO32=0x0000000000000000000000000000000000000000000000000000000000000000
NO_PERMIT="(0,0,0,$ZERO32,$ZERO32)"
ENTER_SIG="enter((uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,bool),(uint256,uint256,uint8,bytes32,bytes32))"
BTC_ENTER_SIG="enterFromBtc((uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,bool),(uint256,uint256,uint8,bytes32,bytes32))"
EXIT_SIG="exit((uint256,uint256,uint256,uint256,uint256,uint256,address),(uint256,uint256,uint8,bytes32,bytes32))"
BORROW_SIG="borrowAndEnter((uint256,address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,bool))"

: "${PRIVATE_KEY:?set PRIVATE_KEY}"
: "${EXECUTOR:?set EXECUTOR}"
AMOUNT=${AMOUNT:-20000000000000000000}
BTC_AMOUNT=${BTC_AMOUNT:-300000000000000}
WAIT=${WAIT:-60}
ME=$(cast wallet address "$PRIVATE_KEY")

calc() { python3 -c "print(int($1))"; }
first() { awk '{print $1}'; }
# The public testnet RPC intermittently returns null for receipts, so submit asynchronously
# and poll for the receipt; fail if the transaction reverted.
send() {
  local hash status i est limit
  est=$(cast estimate "$@" --from "$ME" --rpc-url "$RPC" | first)
  limit=$(calc "$est * ${GAS_MULT:-2}")
  # The testnet RPC can under-estimate gas (a 99,138 limit ran out at 98,696 on a gauge.withdraw), so pad generously.
  hash=$(cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --gas-limit "$limit" --async)
  echo "  $EXPLORER/$hash" >&2
  for i in $(seq 1 30); do
    status=$(cast receipt "$hash" status --rpc-url "$RPC" 2>/dev/null | first || true)
    if [[ -n "$status" ]]; then
      [[ "$status" == "1" ]] || { echo "  reverted: $hash" >&2; exit 1; }
      echo "  gas ${GL:-tx}: used $(cast receipt "$hash" gasUsed --rpc-url "$RPC" | first) estimate $est limit $limit  block $(cast receipt "$hash" blockNumber --rpc-url "$RPC" | first)" >&2
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
enter_params() { # amount recipient [stake] -> tuple
  local fee net swap btc_out
  fee=$(cast call "$EXECUTOR" "feeBps()(uint256)" --rpc-url "$RPC" | first)
  net=$(calc "$1 - $1 * $fee // 10000")
  swap=$(calc "$net // 2")
  btc_out=$(quote_swap "$MUSD" "$BTC" "$swap")
  echo "($1,$swap,$(calc "$btc_out * 99 // 100"),0,0,0,$(( $(date +%s) + 600 )),$2,${3:-false})"
}
btc_params() { # btcIn recipient [stake] -> tuple
  local fee net swap musd_out
  fee=$(cast call "$EXECUTOR" "feeBps()(uint256)" --rpc-url "$RPC" | first)
  net=$(calc "$1 - $1 * $fee // 10000")
  swap=$(calc "$net // 2")
  musd_out=$(quote_swap "$BTC" "$MUSD" "$swap")
  echo "($1,$swap,$(calc "$musd_out * 99 // 100"),0,0,0,$(( $(date +%s) + 600 )),$2,${3:-false})"
}
bal() { cast call "$1" "balanceOf(address)(uint256)" "$2" --rpc-url "$RPC" | first; }
cmpv() { python3 -c "print(int($1 $2 $3))"; } # a op b on big integers
require() { [[ "$1" == "1" ]] || { echo "FAIL: $2" >&2; exit 1; }; }
exit_lp() { # lpAmount -> exits through the executor
  local lp=$1 musd_r btc_r swap_out min_out
  read -r musd_r btc_r < <(cast call "$ROUTER" "quoteRemoveLiquidity(address,address,bool,address,uint256)(uint256,uint256)" \
    "$MUSD" "$BTC" false "$FACTORY" "$lp" --rpc-url "$RPC" | first | paste -sd' ' -)
  swap_out=$(quote_swap "$BTC" "$MUSD" "$btc_r")
  min_out=$(calc "($musd_r + $swap_out) * 99 // 100")
  GL="approve LP" send "$POOL" "approve(address,uint256)" "$EXECUTOR" "$lp" >/dev/null
  GL="exit" send "$EXECUTOR" "$EXIT_SIG" "($lp,0,0,0,$min_out,$(( $(date +%s) + 600 )),$ME)" "$NO_PERMIT" >/dev/null
}

executor_balances() {
  echo "$(cast call "$MUSD" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)" \
    "$(cast call "$BTC" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)" \
    "$(cast call "$POOL" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)"
}
BEFORE=$(executor_balances)

CAP=$(cast call "$EXECUTOR" "maxMusdIn()(uint256)" --rpc-url "$RPC" | first)
echo "== cap $CAP: an entry of cap + 1 must revert with AmountAboveCap (eth_call only)"
if OUT=$(cast call "$EXECUTOR" "$ENTER_SIG" "$(enter_params "$(calc "$CAP + 1")" "$ME")" "$NO_PERMIT" \
  --from "$ME" --rpc-url "$RPC" 2>&1); then
  echo "FAIL: entry above the cap did not revert" >&2
  exit 1
fi
grep -q "$(cast sig "AmountAboveCap()")" <<<"$OUT" || { echo "FAIL: unexpected revert: $OUT" >&2; exit 1; }

echo "== BTC token EIP-2612 domain: DOMAIN_SEPARATOR must equal hash(BTC, 1, 31611, token)"
DOMAIN_TYPE=$(cast keccak "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
WANT_DOMAIN=$(cast keccak "$(cast abi-encode "f(bytes32,bytes32,bytes32,uint256,address)" "$DOMAIN_TYPE" "$(cast keccak BTC)" "$(cast keccak 1)" 31611 "$BTC")")
GOT_DOMAIN=$(cast call "$BTC" "DOMAIN_SEPARATOR()(bytes32)" --rpc-url "$RPC")
echo "  $GOT_DOMAIN"
[[ "$GOT_DOMAIN" == "$WANT_DOMAIN" ]] || { echo "FAIL: BTC domain separator differs from hash(BTC,1,31611,token): want $WANT_DOMAIN" >&2; exit 1; }

echo "== immutables: gauge and BTC cap"
[[ "$(cast call "$EXECUTOR" "gauge()(address)" --rpc-url "$RPC")" == "$GAUGE" ]] || { echo "FAIL: executor gauge differs" >&2; exit 1; }
[[ "$(cast call "$GAUGE" "stakingToken()(address)" --rpc-url "$RPC")" == "$POOL" ]] || { echo "FAIL: gauge stakingToken is not the pool" >&2; exit 1; }
REWARD=$(cast call "$GAUGE" "rewardToken()(address)" --rpc-url "$RPC")
BTC_CAP=$(cast call "$EXECUTOR" "maxBtcIn()(uint256)" --rpc-url "$RPC" | first)
echo "  gauge $GAUGE reward token $REWARD, BTC cap $BTC_CAP"
if OUT=$(cast call "$EXECUTOR" "$BTC_ENTER_SIG" "($(calc "$BTC_CAP + 1"),1,0,0,0,0,$(( $(date +%s) + 600 )),$ME,false)" "$NO_PERMIT" \
  --from "$ME" --rpc-url "$RPC" 2>&1); then
  echo "FAIL: BTC entry above the cap did not revert" >&2
  exit 1
fi
grep -q "$(cast sig "AmountAboveCap()")" <<<"$OUT" || { echo "FAIL: unexpected revert: $OUT" >&2; exit 1; }

echo "== enter $AMOUNT MUSD as $ME (no stake)"
LP0=$(bal "$POOL" "$ME")
GL="approve MUSD" send "$MUSD" "approve(address,uint256)" "$EXECUTOR" "$(calc "$AMOUNT * 4")" >/dev/null
GL="enter (no stake)" send "$EXECUTOR" "$ENTER_SIG" "$(enter_params "$AMOUNT" "$ME" false)" "$NO_PERMIT" >/dev/null
LP1=$(bal "$POOL" "$ME")
require "$(cmpv "$LP1" ">" "$LP0")" "enter without stake did not add LP to the wallet"
echo "== stake that LP directly: gauge.deposit(lp, me), then gauge.withdraw"
DIRECT=$(calc "$LP1 - $LP0"); G0=$(bal "$GAUGE" "$ME")
GL="approve LP to gauge" send "$POOL" "approve(address,uint256)" "$GAUGE" "$DIRECT" >/dev/null
GL="gauge.deposit" send "$GAUGE" "deposit(uint256,address)" "$DIRECT" "$ME" >/dev/null
require "$(cmpv "$(bal "$GAUGE" "$ME")" "==" "$G0 + $DIRECT")" "gauge.deposit did not credit the LP"
GL="gauge.withdraw" send "$GAUGE" "withdraw(uint256)" "$DIRECT" >/dev/null
require "$(cmpv "$(bal "$POOL" "$ME")" "==" "$LP1")" "direct gauge.withdraw did not return the LP"
echo "== exit that LP"
exit_lp "$DIRECT"

echo "== enter $AMOUNT MUSD and stake"
G0=$(bal "$GAUGE" "$ME"); LP0=$(bal "$POOL" "$ME"); MEZO0=$(bal "$REWARD" "$ME")
GL="enter (stake)" send "$EXECUTOR" "$ENTER_SIG" "$(enter_params "$AMOUNT" "$ME" true)" "$NO_PERMIT" >/dev/null
G1=$(bal "$GAUGE" "$ME"); LP1=$(bal "$POOL" "$ME")
require "$(cmpv "$G1" ">" "$G0")" "gauge.balanceOf(me) did not grow after enter with stake"
require "$(cmpv "$LP1" "==" "$LP0")" "enter with stake left LP in the wallet"
STAKED=$(calc "$G1 - $G0")
echo "  staked $STAKED LP"

echo "== wait ${WAIT}s, then earned(me) must be > 0"
sleep "$WAIT"
EARNED=$(cast call "$GAUGE" "earned(address)(uint256)" "$ME" --rpc-url "$RPC" | first)
echo "  earned $EARNED"
require "$(cmpv "$EARNED" ">" 0)" "earned(me) is 0 after ${WAIT}s"
GL="gauge.getReward" send "$GAUGE" "getReward(address)" "$ME" >/dev/null
MEZO1=$(bal "$REWARD" "$ME")
require "$(cmpv "$MEZO1" ">" "$MEZO0")" "MEZO balance did not grow after getReward"
echo "  MEZO +$(calc "$MEZO1 - $MEZO0")"

echo "== gauge.withdraw, then exit"
GL="gauge.withdraw" send "$GAUGE" "withdraw(uint256)" "$STAKED" >/dev/null
LP2=$(bal "$POOL" "$ME")
require "$(cmpv "$LP2 - $LP1" "==" "$STAKED")" "gauge.withdraw did not return the staked LP"
require "$(cmpv "$(bal "$GAUGE" "$ME")" "==" "$G0")" "gauge balance did not return to its start"
exit_lp "$STAKED"

echo "== enterFromBtc $BTC_AMOUNT BTC (no stake)"
LP0=$(bal "$POOL" "$ME")
GL="approve BTC" send "$BTC" "approve(address,uint256)" "$EXECUTOR" "$(calc "$BTC_AMOUNT * 4")" >/dev/null
FIXTURE_PARAMS=$(btc_params "$BTC_AMOUNT" "$ME" false)
FIXTURE_TX=$(GL="enterFromBtc (no stake)" send "$EXECUTOR" "$BTC_ENTER_SIG" "$FIXTURE_PARAMS" "$NO_PERMIT")
LP1=$(bal "$POOL" "$ME")
require "$(cmpv "$LP1" ">" "$LP0")" "enterFromBtc without stake did not add LP to the wallet"
echo "  fixture tx $FIXTURE_TX"
echo "  fixture receipt: block $(cast receipt "$FIXTURE_TX" blockNumber --rpc-url "$RPC" | first), index $(cast receipt "$FIXTURE_TX" transactionIndex --rpc-url "$RPC" | first)"
exit_lp "$(calc "$LP1 - $LP0")"

echo "== enterFromBtc $BTC_AMOUNT BTC and stake"
G0=$(bal "$GAUGE" "$ME"); LP0=$(bal "$POOL" "$ME")
GL="enterFromBtc (stake)" send "$EXECUTOR" "$BTC_ENTER_SIG" "$(btc_params "$BTC_AMOUNT" "$ME" true)" "$NO_PERMIT" >/dev/null
G1=$(bal "$GAUGE" "$ME")
require "$(cmpv "$G1" ">" "$G0")" "gauge.balanceOf(me) did not grow after enterFromBtc with stake"
require "$(cmpv "$(bal "$POOL" "$ME")" "==" "$LP0")" "enterFromBtc with stake left LP in the wallet"
STAKED=$(calc "$G1 - $G0")
GL="gauge.withdraw" send "$GAUGE" "withdraw(uint256)" "$STAKED" >/dev/null
exit_lp "$STAKED"

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
if [[ "$AFTER" != "0 0 0" ]]; then
  echo "FAIL: executor holds funds: MUSD BTC LP [$AFTER]" >&2
  exit 1
fi
echo "PASS: executor holds no MUSD, BTC, or LP"
[[ "$(bal "$GAUGE" "$EXECUTOR")" == "0" ]] || { echo "FAIL: executor holds gauge stake" >&2; exit 1; }
echo "PASS: executor holds no gauge stake"
