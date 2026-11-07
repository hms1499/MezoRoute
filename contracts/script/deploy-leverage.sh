#!/usr/bin/env bash
# Deploys MezoRouteLeverage with `cast send --create` and reads every immutable back.
# `forge script` simulates locally, where Mezo's BTC precompile does not exist, so it is not used to send.
#
# Required env:
#   NETWORK        testnet | mainnet (not CHAIN: Foundry reads that as --chain)
#   FEE_BPS        e.g. 10
#   FEE_RECIPIENT  address
#   and one signer: PRIVATE_KEY (testnet only) or ACCOUNT (an encrypted Foundry keystore name, e.g. mezo-mainnet)
set -euo pipefail
cd "$(dirname "$0")/.."

: "${NETWORK:?set NETWORK=testnet|mainnet}"
: "${FEE_BPS:?set FEE_BPS}"
: "${FEE_RECIPIENT:?set FEE_RECIPIENT}"
case "$NETWORK" in
  testnet) CHAIN_ID=31611; RPC=${RPC:-https://rpc.test.mezo.org}; EXPLORER=https://explorer.test.mezo.org ;;
  mainnet) CHAIN_ID=31612; RPC=${RPC:-https://rpc-internal.mezo.org}; EXPLORER=https://explorer.mezo.org ;;
  *) echo "NETWORK must be testnet or mainnet" >&2; exit 1 ;;
esac
if [[ -n "${ACCOUNT:-}" ]]; then
  SIGNER=(--account "$ACCOUNT")
  ME=$(cast wallet address --account "$ACCOUNT")
else
  : "${PRIVATE_KEY:?set PRIVATE_KEY or ACCOUNT}"
  [[ "$NETWORK" == "testnet" ]] || { echo "mainnet deploys use ACCOUNT (keystore), never PRIVATE_KEY" >&2; exit 1; }
  SIGNER=(--private-key "$PRIVATE_KEY")
  ME=$(cast wallet address --private-key "$PRIVATE_KEY")
fi
first() { awk '{print $1}'; }
lc() { tr '[:upper:]' '[:lower:]'; }

forge build >/dev/null
BYTECODE=$(jq -r '.bytecode.object' out/MezoRouteLeverage.sol/MezoRouteLeverage.json)
ARGS=$(forge script script/DeployLeverage.s.sol --sig "print(uint256,uint256,address)" "$CHAIN_ID" "$FEE_BPS" "$FEE_RECIPIENT" 2>/dev/null \
  | grep -Eo '0x[0-9a-f]+' | tail -1)
[[ ${#ARGS} -gt 2 ]] || { echo "could not build constructor args" >&2; exit 1; }
DATA="${BYTECODE}${ARGS#0x}"

echo "== deploying MezoRouteLeverage on $NETWORK from $ME"
EST=$(cast estimate --from "$ME" --rpc-url "$RPC" --create "$DATA" | first)
LIMIT=$(python3 -c "print(int($EST * 13 // 10))")
HASH=$(cast send "${SIGNER[@]}" --rpc-url "$RPC" --gas-limit "$LIMIT" --async --create "$DATA")
echo "  $EXPLORER/tx/$HASH"
for _ in $(seq 1 60); do
  STATUS=$(cast receipt "$HASH" status --rpc-url "$RPC" 2>/dev/null | first || true)
  [[ -n "$STATUS" ]] && break
  sleep 2
done
[[ "${STATUS:-}" == "1" ]] || { echo "deploy failed or no receipt: $HASH" >&2; exit 1; }
ADDR=$(cast receipt "$HASH" contractAddress --rpc-url "$RPC")
BLOCK=$(cast receipt "$HASH" blockNumber --rpc-url "$RPC" | first)
echo "  address $ADDR  block $BLOCK  gas $(cast receipt "$HASH" gasUsed --rpc-url "$RPC" | first)"

# Read back every immutable against the inputs.
read -r -a WANT < <(forge script script/DeployLeverage.s.sol --sig "configFor(uint256,uint256,address)" "$CHAIN_ID" "$FEE_BPS" "$FEE_RECIPIENT" --json 2>/dev/null \
  | jq -r '.returns.c.value' | tr -d '()' | tr ',' ' ')
check() { # getter expected
  local got
  got=$(cast call "$ADDR" "$1" --rpc-url "$RPC" | first)
  [[ "$(echo "$got" | lc)" == "$(echo "$2" | lc)" ]] || { echo "FAIL: $1 = $got, want $2" >&2; exit 1; }
  echo "  ok $1 = $got"
}
check "musd()(address)" "${WANT[0]}"
check "btc()(address)" "${WANT[1]}"
check "factory()(address)" "${WANT[2]}"
check "pool()(address)" "${WANT[3]}"
check "borrowerOperationsSignatures()(address)" "${WANT[4]}"
check "troveManager()(address)" "${WANT[5]}"
check "priceFeed()(address)" "${WANT[6]}"
check "feeBps()(uint256)" "${WANT[7]}"
check "feeRecipient()(address)" "${WANT[8]}"
check "maxBtcFlash()(uint256)" "${WANT[9]}"
check "maxMusdFlash()(uint256)" "${WANT[10]}"
TOKEN0=$(cast call "${WANT[3]}" "token0()(address)" --rpc-url "$RPC")
check "btcIsToken0()(bool)" "$([[ "$(echo "$TOKEN0" | lc)" == "$(echo "${WANT[1]}" | lc)" ]] && echo true || echo false)"
echo "PASS: deployed $ADDR at block $BLOCK"
