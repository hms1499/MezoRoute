#!/usr/bin/env bash
# Live Mezo testnet smoke test for a deployed MezoRouteLeverage, on the signer's own Trove:
#   1. unwind a little debt, 2. leverage a little BTC, 3. close the Trove, 4. open it again with leverage.
# Mezo's BTC is a chain precompile and BorrowerOperationsSignatures checks real signatures, so this is the
# only proof of the msg.value leg and the real BOS calls; every call goes to testnet through `cast`.
#
# Required env:
#   PRIVATE_KEY  testnet key that owns an open Trove (≥ 2,050 MUSD debt, capacity for ~160 MUSD more)
#                and holds ≥ 0.04 BTC
#   LEVERAGE     deployed MezoRouteLeverage address
# Optional env:
#   GAS_MULT     gas limit = estimate × GAS_MULT (default 1.3; Mezo charges at least half the limit)
#   OUT          file to write the signed authorisations to (JSON lines), for the frontend's recovery tests
set -euo pipefail

RPC=${RPC:-https://rpc.test.mezo.org}
EXPLORER=https://explorer.test.mezo.org/tx
CHAIN_ID=31611
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
BTC=0x7b7C000000000000000000000000000000000000
POOL=0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9
FACTORY=0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A
BOS=0xD757e3646AF370b15f32EB557F0F8380Df7D639e
BO=0xCdF7028ceAB81fA0C6971208e83fa7872994beE5
TM=0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0
PRICE_FEED=0x86bCF0841622a5dAC14A313a15f96A95421b9366
HINTS=0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6
SORTED=0x722E4D24FD6Ff8b0AC679450F3D91294607268fA
ZERO=0x0000000000000000000000000000000000000000
DEV=500

: "${PRIVATE_KEY:?set PRIVATE_KEY}"
: "${LEVERAGE:?set LEVERAGE}"
OUT=${OUT:-/dev/null}
ME=$(cast wallet address --private-key "$PRIVATE_KEY")

calc() { python3 -c "print(int($1))"; }
first() { awk '{print $1}'; }
require() { [[ "$1" == "1" ]] || { echo "FAIL: $2" >&2; exit 1; }; }
call() { cast call "$@" --rpc-url "$RPC" | head -1 | first; }

send() { # same polling as smoke-testnet.sh: the testnet RPC sometimes returns null receipts
  local hash status est limit value=()
  if [[ -n "${VALUE:-}" ]]; then value=(--value "$VALUE"); fi
  est=$(cast estimate "$@" ${value[@]+"${value[@]}"} --from "$ME" --rpc-url "$RPC" | first)
  limit=$(python3 -c "print(int($est * ${GAS_MULT:-1.3}))")
  hash=$(cast send "$@" ${value[@]+"${value[@]}"} --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --gas-limit "$limit" --async)
  echo "  $EXPLORER/$hash" >&2
  for _ in $(seq 1 45); do
    status=$(cast receipt "$hash" status --rpc-url "$RPC" 2>/dev/null | first || true)
    if [[ -n "$status" ]]; then
      [[ "$status" == "1" ]] || { echo "  reverted: $hash" >&2; exit 1; }
      echo "  gas ${GL:-tx}: used $(cast receipt "$hash" gasUsed --rpc-url "$RPC" | first) estimate $est limit $limit block $(cast receipt "$hash" blockNumber --rpc-url "$RPC" | first)" >&2
      echo "$hash"
      return
    fi
    sleep 2
  done
  echo "  no receipt after 90s: $hash" >&2
  exit 1
}

# ---- chain reads -------------------------------------------------------------------------------
trove() { # -> coll principal interest (pending included)
  cast call "$TM" "getEntireDebtAndColl(address)(uint256,uint256,uint256,uint256,uint256,uint256)" "$ME" --rpc-url "$RPC" \
    | awk 'NR<=6 {print $1}' | paste -sd' ' - \
    | awk '{printf "%s %s %s %s %s %s\n", $1, $2, $3, $4, $5, $6}'
}
reserves() { # -> reserveMusd reserveBtc
  local r0 r1
  read -r r0 r1 < <(cast call "$POOL" "getReserves()(uint256,uint256,uint256)" --rpc-url "$RPC" | awk 'NR<=2 {print $1}' | paste -sd' ' -)
  if [[ "$(call "$LEVERAGE" "btcIsToken0()(bool)")" == "true" ]]; then echo "$r1 $r0"; else echo "$r0 $r1"; fi
}
FEE=$(call "$FACTORY" "getFee(address,bool)(uint256)" "$POOL" false)
btc_in() { local rm rb; read -r rm rb < <(reserves); call "$LEVERAGE" "exactInput(uint256,uint256,uint256,uint256)(uint256)" "$rb" "$rm" "$1" "$FEE"; }
musd_in() { local rm rb; read -r rm rb < <(reserves); call "$LEVERAGE" "exactInput(uint256,uint256,uint256,uint256)(uint256)" "$rm" "$rb" "$1" "$FEE"; }
hints() { # newColl newPrincipal -> "upper lower"
  local nicr size trials approx
  nicr=$(calc "$1 * 10**20 // $2")
  size=$(call "$SORTED" "getSize()(uint256)")
  trials=$(python3 -c "import math; n=$size; r=math.isqrt(n); print(15*(r if r*r==n else r+1))")
  approx=$(call "$HINTS" "getApproxHint(uint256,uint256,uint256)(address,uint256,uint256)" "$nicr" "$trials" 42)
  cast call "$SORTED" "findInsertPosition(uint256,address,address)(address,address)" "$nicr" "$approx" "$approx" --rpc-url "$RPC" | paste -sd' ' -
}
lev_balances() { echo "$(call "$MUSD" "balanceOf(address)(uint256)" "$LEVERAGE") $(call "$BTC" "balanceOf(address)(uint256)" "$LEVERAGE")"; }

# ---- signatures -------------------------------------------------------------------------------
sign_typed() { # json -> signature; records the message for the frontend tests
  local file sig
  file=$(mktemp)
  echo "$1" >"$file"
  sig=$(cast wallet sign --private-key "$PRIVATE_KEY" --data --from-file "$file")
  rm -f "$file"
  echo "{\"typedData\":$1,\"signature\":\"$sig\",\"signer\":\"$ME\"}" >>"$OUT"
  echo "$sig"
}
DOMAIN="{\"name\":\"BorrowerOperationsSignatures\",\"version\":\"1\",\"chainId\":$CHAIN_ID,\"verifyingContract\":\"$BOS\"}"
EIP712="{\"name\":\"name\",\"type\":\"string\"},{\"name\":\"version\",\"type\":\"string\"},{\"name\":\"chainId\",\"type\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\"}"
sign_adjust() { # collWithdrawal debtChange isIncrease assetAmount nonce deadline
  sign_typed "{\"types\":{\"EIP712Domain\":[$EIP712],\"AdjustTrove\":[{\"name\":\"collWithdrawal\",\"type\":\"uint256\"},{\"name\":\"debtChange\",\"type\":\"uint256\"},{\"name\":\"isDebtIncrease\",\"type\":\"bool\"},{\"name\":\"assetAmount\",\"type\":\"uint256\"},{\"name\":\"borrower\",\"type\":\"address\"},{\"name\":\"recipient\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\"}]},\"primaryType\":\"AdjustTrove\",\"domain\":$DOMAIN,\"message\":{\"collWithdrawal\":\"$1\",\"debtChange\":\"$2\",\"isDebtIncrease\":$3,\"assetAmount\":\"$4\",\"borrower\":\"$ME\",\"recipient\":\"$ME\",\"nonce\":\"$5\",\"deadline\":\"$6\"}}"
}
sign_close() { # nonce deadline
  sign_typed "{\"types\":{\"EIP712Domain\":[$EIP712],\"CloseTrove\":[{\"name\":\"borrower\",\"type\":\"address\"},{\"name\":\"recipient\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\"}]},\"primaryType\":\"CloseTrove\",\"domain\":$DOMAIN,\"message\":{\"borrower\":\"$ME\",\"recipient\":\"$ME\",\"nonce\":\"$1\",\"deadline\":\"$2\"}}"
}
sign_open() { # assetAmount debtAmount nonce deadline
  sign_typed "{\"types\":{\"EIP712Domain\":[$EIP712],\"OpenTrove\":[{\"name\":\"assetAmount\",\"type\":\"uint256\"},{\"name\":\"debtAmount\",\"type\":\"uint256\"},{\"name\":\"borrower\",\"type\":\"address\"},{\"name\":\"recipient\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\"}]},\"primaryType\":\"OpenTrove\",\"domain\":$DOMAIN,\"message\":{\"assetAmount\":\"$1\",\"debtAmount\":\"$2\",\"borrower\":\"$ME\",\"recipient\":\"$ME\",\"nonce\":\"$3\",\"deadline\":\"$4\"}}"
}
permit() { # token name value deadline -> "(value,deadline,v,r,s)"
  local nonce sig file
  nonce=$(call "$1" "nonces(address)(uint256)" "$ME")
  file=$(mktemp)
  echo "{\"types\":{\"EIP712Domain\":[$EIP712],\"Permit\":[{\"name\":\"owner\",\"type\":\"address\"},{\"name\":\"spender\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\"}]},\"primaryType\":\"Permit\",\"domain\":{\"name\":\"$2\",\"version\":\"1\",\"chainId\":$CHAIN_ID,\"verifyingContract\":\"$1\"},\"message\":{\"owner\":\"$ME\",\"spender\":\"$LEVERAGE\",\"value\":\"$3\",\"nonce\":\"$nonce\",\"deadline\":\"$4\"}}" >"$file"
  sig=$(cast wallet sign --private-key "$PRIVATE_KEY" --data --from-file "$file")
  rm -f "$file"
  echo "($3,$4,$((16#${sig:130:2})),0x${sig:2:64},0x${sig:66:64})"
}
deadline() { calc "$(cast block latest --field timestamp --rpc-url "$RPC") + 900"; }
check_after() { # label startBalances
  local now
  now=$(lev_balances)
  [[ "$now" == "$2" ]] || { echo "FAIL: $1 changed the contract's balances ($2 -> $now)" >&2; exit 1; }
  require "$(cmp0 "$(call "$BTC" "allowance(address,address)(uint256)" "$ME" "$LEVERAGE")")" "$1 left a BTC allowance"
  require "$(cmp0 "$(call "$MUSD" "allowance(address,address)(uint256)" "$ME" "$LEVERAGE")")" "$1 left a MUSD allowance"
}
cmp0() { python3 -c "print(int(int($1) == 0))"; }

UNWIND_SIG="unwind((uint256,uint256,uint256,uint256,uint256),(address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32))"
CLOSE_SIG="close((uint256,uint256,uint256),(address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32))"
LEVERAGE_SIG="leverage((uint256,uint256,uint256,uint256,uint256,uint256),(address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32))"
OPEN_SIG="openLeveraged((uint256,uint256,uint256,uint256,uint256,uint256),(address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32))"

[[ "$(call "$TM" "getTroveStatus(address)(uint8)" "$ME")" == "1" ]] || { echo "FAIL: $ME has no active Trove" >&2; exit 1; }
START=$(lev_balances)
echo "== smoke on $LEVERAGE from $ME (pool fee $FEE bps, contract balances $START)"

# ---- 1. unwind ----------------------------------------------------------------------------------
read -r COLL PRIN INT PC PP PI < <(trove)
echo "  pending redistribution: coll $PC principal $PP interest $PI"
REPAY=50000000000000000000
NEED=$(btc_in "$REPAY")
W=$(calc "$NEED * 102 // 100")
NEW_PRIN=$(python3 -c "r=$REPAY; i=$INT; p=$PRIN; print(p - max(0, r - i))")
read -r UP LO < <(hints "$(calc "$COLL - $W")" "$NEW_PRIN")
D=$(deadline); N=$(call "$BOS" "getNonce(address)(uint256)" "$ME")
SIG=$(sign_adjust "$W" "$REPAY" false 0 "$N" "$D")
echo "== unwind: repay 50 MUSD, withdraw $W BTC wei (pool needs $NEED)"
GL=unwind send "$LEVERAGE" "$UNWIND_SIG" "($REPAY,$W,$W,$DEV,$D)" "($UP,$LO,$SIG,$D)" "$(permit "$BTC" BTC "$W" "$D")" >/dev/null
check_after unwind "$START"
read -r COLL2 PRIN2 INT2 _ _ _ < <(trove)
require "$(python3 -c "print(int($COLL - $COLL2 == $W))")" "unwind: collateral fell by $((COLL - COLL2)), want $W"
require "$(python3 -c "print(int(abs(($PRIN + $INT) - ($PRIN2 + $INT2) - $REPAY) < 10**16))")" "unwind: debt did not fall by 50 MUSD"

# ---- 2. leverage --------------------------------------------------------------------------------
ADD=2000000000000000
MAXM=$(calc "$(musd_in "$ADD") * 102 // 100")
PULL=$(calc "$MAXM + $MAXM * 10 // 10000")
RATE=$(call "$BO" "borrowingRate()(uint256)")
read -r COLL PRIN INT _ _ _ < <(trove)
read -r UP LO < <(hints "$(calc "$COLL + $ADD")" "$(calc "$PRIN + $PULL + $PULL * $RATE // 10**18")")
D=$(deadline); N=$(call "$BOS" "getNonce(address)(uint256)" "$ME")
SIG=$(sign_adjust 0 "$PULL" true "$ADD" "$N" "$D")
MUSD_BEFORE=$(call "$MUSD" "balanceOf(address)(uint256)" "$ME")
echo "== leverage: add $ADD BTC wei, borrow $PULL MUSD wei"
GL=leverage send "$LEVERAGE" "$LEVERAGE_SIG" "($ADD,$PULL,$MAXM,1500000000000000000,$DEV,$D)" "($UP,$LO,$SIG,$D)" "$(permit "$MUSD" "Mezo USD" "$PULL" "$D")" >/dev/null
check_after leverage "$START"
read -r COLL2 _ _ _ _ _ < <(trove)
require "$(python3 -c "print(int($COLL2 - $COLL == $ADD))")" "leverage: collateral rose by $((COLL2 - COLL)), want $ADD"
echo "  MUSD surplus to wallet: $(python3 -c "print($(call "$MUSD" "balanceOf(address)(uint256)" "$ME") - $MUSD_BEFORE)") wei"

# ---- 3. close -----------------------------------------------------------------------------------
read -r COLL PRIN INT _ _ _ < <(trove)
MAXB=$(calc "$(btc_in "$(calc "$PRIN + $INT - 200 * 10**18 + 10**18")") * 102 // 100")
D=$(deadline); N=$(call "$BOS" "getNonce(address)(uint256)" "$ME")
SIG=$(sign_close "$N" "$D")
BTC_BEFORE=$(call "$BTC" "balanceOf(address)(uint256)" "$ME")
echo "== close: collateral $COLL, max BTC to the pool $MAXB"
GL=close send "$LEVERAGE" "$CLOSE_SIG" "($MAXB,$DEV,$D)" "($ZERO,$ZERO,$SIG,$D)" "$(permit "$BTC" BTC "$MAXB" "$D")" >/dev/null
check_after close "$START"
[[ "$(call "$TM" "getTroveStatus(address)(uint8)" "$ME")" != "1" ]] || { echo "FAIL: close left the Trove active" >&2; exit 1; }
echo "  BTC to wallet (net of gas): $(python3 -c "print($(call "$BTC" "balanceOf(address)(uint256)" "$ME") - $BTC_BEFORE)") wei"

# ---- 4. open with leverage ----------------------------------------------------------------------
OWN=35000000000000000
FLASH=10000000000000000
MAXM=$(calc "$(musd_in "$FLASH") * 102 // 100")
PULL=$(calc "$MAXM + $MAXM * 10 // 10000")
DEBT=$(python3 -c "print(max($PULL, 1800 * 10**18))")
RATE=$(call "$BO" "borrowingRate()(uint256)")
read -r UP LO < <(hints "$(calc "$OWN + $FLASH")" "$(calc "$DEBT + $DEBT * $RATE // 10**18 + 200 * 10**18")")
D=$(deadline); N=$(call "$BOS" "getNonce(address)(uint256)" "$ME")
SIG=$(sign_open "$(calc "$OWN + $FLASH")" "$DEBT" "$N" "$D")
echo "== openLeveraged: own $OWN + flash $FLASH BTC wei, debt $DEBT"
VALUE=$OWN GL=open send "$LEVERAGE" "$OPEN_SIG" "($FLASH,$DEBT,$MAXM,1500000000000000000,$DEV,$D)" "($UP,$LO,$SIG,$D)" "$(permit "$MUSD" "Mezo USD" "$PULL" "$D")" >/dev/null
check_after open "$START"
read -r COLL _ _ _ _ _ < <(trove)
require "$(python3 -c "print(int($COLL == $OWN + $FLASH))")" "open: collateral $COLL, want $((OWN + FLASH))"

echo "PASS: unwind, leverage, close, openLeveraged; contract balances unchanged ($START), no allowance left"
