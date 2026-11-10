import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import {
  ABOVE_HEADROOM,
  aboveCap,
  aboveCapBtc,
  AMOUNT_TOO_SMALL,
  CR_FLOOR,
  FEE_MISMATCH,
  INSUFFICIENT_BALANCE,
  INSUFFICIENT_BTC,
  KEEP_GAS_BTC,
  rpcUnavailable,
  needsGas,
  NO_TROVE,
  noExecutor,
  PRICE_IMPACT,
  QUOTE_EXPIRED,
  RECOVERY_MODE,
  SMART_ACCOUNT_BORROW,
  wrongNetwork,
} from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { BtcEntryQuote, EntryQuote } from "@/lib/quote/entry";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";

/** 5% (PRODUCT_SPEC §12, provisional until integration tests); 1e18 = 100%. */
export const PRICE_IMPACT_LIMIT = 50_000_000_000_000_000n;
/** U14 B3: from 1% the price-impact row reads as a warning, before the 5% limit blocks the entry. */
export const PRICE_IMPACT_WARN = 10_000_000_000_000_000n;
/** A quote's lifetime (PRODUCT_SPEC §12). */
export const QUOTE_TTL_MS = 60_000;

/** Borrow & Deploy's extra inputs; absent in deposit mode. `limit` is `borrowLimit` (headroom and cap). */
export type BorrowGate = { canSign: boolean; hasTrove: boolean; recoveryMode: boolean; limit: bigint; newCr: bigint | null };

/**
 * A BTC entry's inputs (V2 `enterFromBtc`); absent for MUSD. `gasReserve` stays in the wallet for the steps still
 * to come: BTC is also the gas, so `btcIn + gasReserve` may not exceed the balance. It is null while the gas price
 * is unknown, and the entry is then blocked with a retry (Ruling P18); the MUSD route is not.
 */
export type BtcGate = { btcIn: bigint | null; walletBtc: bigint; maxBtcIn: bigint; gasReserve: bigint | null };

export type EntryGateInput = {
  network: NetworkConfig;
  walletChainId: number | undefined;
  chainFeeBps: bigint;
  musdIn: bigint | null;
  walletMusd: bigint;
  maxMusdIn: bigint;
  quote: EntryQuote | BtcEntryQuote | null;
  lacksGas: boolean;
  quoteAgeMs: number;
  borrow?: BorrowGate | null;
  btc?: BtcGate | null;
};

export type EntryBlockReason =
  | "no-executor"
  | "fee-mismatch"
  | "wrong-network"
  | "zero"
  | "insufficient-balance"
  | "above-cap"
  | "too-small"
  | "price-impact"
  | "needs-gas"
  | "gas-price-unknown"
  | "quote-expired"
  | "smart-account-borrow"
  | "no-trove"
  | "recovery-mode"
  | "cr-floor"
  | "above-headroom";

/** The swap a quote makes: what goes in and what comes out, whichever token that is. */
function swapOf(quote: EntryQuote | BtcEntryQuote): { input: bigint; output: bigint } {
  return "btcIn" in quote
    ? { input: quote.btcToSwap, output: quote.musdFromSwap }
    : { input: quote.musdToSwap, output: quote.btcFromSwap };
}

/** `outcome` is null when the button simply stays disabled (no amount yet). */
export type EntryBlock = { reason: EntryBlockReason; outcome: Outcome | null };

/** Why entry is blocked; the first matching reason wins (FR-01, FR-05, FR-22). */
export function entryBlock(input: EntryGateInput): EntryBlock | null {
  const { network, quote } = input;
  const block = (reason: EntryBlockReason, outcome: Outcome | null): EntryBlock => ({ reason, outcome });
  if (!network.executor) return block("no-executor", noExecutor(network));
  if (input.chainFeeBps !== network.executor.feeBps) return block("fee-mismatch", FEE_MISMATCH);
  if (writeBlocker(network, input.walletChainId) === "wrong-network") return block("wrong-network", wrongNetwork(network));
  const borrow = input.borrow ?? null;
  if (borrow && !borrow.canSign) return block("smart-account-borrow", SMART_ACCOUNT_BORROW);
  if (borrow && !borrow.hasTrove) return block("no-trove", NO_TROVE);
  if (borrow?.recoveryMode) return block("recovery-mode", RECOVERY_MODE);
  const btc = input.btc ?? null;
  if (btc) {
    if (btc.btcIn === null) return block("zero", null);
    if (btc.btcIn > btc.walletBtc) return block("insufficient-balance", INSUFFICIENT_BTC);
    if (btc.btcIn > btc.maxBtcIn) return block("above-cap", aboveCapBtc(network));
  } else {
    if (input.musdIn === null) return block("zero", null);
    if (!borrow && input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
    if (input.musdIn > input.maxMusdIn) return block("above-cap", aboveCap(network));
  }
  if (borrow && borrow.newCr !== null && borrow.newCr < CR_SAFETY_FLOOR) return block("cr-floor", CR_FLOOR);
  if (borrow && input.musdIn !== null && input.musdIn > borrow.limit) return block("above-headroom", ABOVE_HEADROOM);
  const swap = quote ? swapOf(quote) : null;
  if (!quote || !swap || swap.input === 0n || swap.input >= quote.net || swap.output === 0n || quote.liquidity === 0n) {
    return block("too-small", AMOUNT_TOO_SMALL);
  }
  if (quote.priceImpact > PRICE_IMPACT_LIMIT) return block("price-impact", PRICE_IMPACT);
  if (input.lacksGas) return block("needs-gas", needsGas(network));
  if (btc && btc.btcIn !== null) {
    if (btc.gasReserve === null) return block("gas-price-unknown", rpcUnavailable(network));
    if (btc.btcIn + btc.gasReserve > btc.walletBtc) return block("needs-gas", KEEP_GAS_BTC);
  }
  if (input.quoteAgeMs > QUOTE_TTL_MS) return block("quote-expired", QUOTE_EXPIRED);
  return null;
}
