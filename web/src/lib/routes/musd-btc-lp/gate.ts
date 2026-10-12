import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import {
  ABOVE_HEADROOM,
  aboveCap,
  AMOUNT_TOO_SMALL,
  CR_FLOOR,
  FEE_MISMATCH,
  INSUFFICIENT_BALANCE,
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
import type { EntryQuote } from "@/lib/quote/entry";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";

/** 5% (PRODUCT_SPEC §12, provisional until integration tests); 1e18 = 100%. */
export const PRICE_IMPACT_LIMIT = 50_000_000_000_000_000n;
/** A quote's lifetime (PRODUCT_SPEC §12). */
export const QUOTE_TTL_MS = 60_000;

/** Borrow & Deploy's extra inputs; absent in deposit mode. `limit` is `borrowLimit` (headroom and cap). */
export type BorrowGate = { canSign: boolean; hasTrove: boolean; recoveryMode: boolean; limit: bigint; newCr: bigint | null };

export type EntryGateInput = {
  network: NetworkConfig;
  walletChainId: number | undefined;
  chainFeeBps: bigint;
  musdIn: bigint | null;
  walletMusd: bigint;
  maxMusdIn: bigint;
  quote: EntryQuote | null;
  lacksGas: boolean;
  quoteAgeMs: number;
  borrow?: BorrowGate | null;
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
  | "quote-expired"
  | "smart-account-borrow"
  | "no-trove"
  | "recovery-mode"
  | "cr-floor"
  | "above-headroom";

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
  if (input.musdIn === null) return block("zero", null);
  if (!borrow && input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
  if (input.musdIn > input.maxMusdIn) return block("above-cap", aboveCap(network));
  if (borrow && borrow.newCr !== null && borrow.newCr < CR_SAFETY_FLOOR) return block("cr-floor", CR_FLOOR);
  if (borrow && input.musdIn > borrow.limit) return block("above-headroom", ABOVE_HEADROOM);
  if (
    !quote ||
    quote.musdToSwap === 0n ||
    quote.musdToSwap >= quote.net ||
    quote.btcFromSwap === 0n ||
    quote.liquidity === 0n
  ) {
    return block("too-small", AMOUNT_TOO_SMALL);
  }
  if (quote.priceImpact > PRICE_IMPACT_LIMIT) return block("price-impact", PRICE_IMPACT);
  if (input.lacksGas) return block("needs-gas", needsGas(network));
  if (input.quoteAgeMs > QUOTE_TTL_MS) return block("quote-expired", QUOTE_EXPIRED);
  return null;
}
