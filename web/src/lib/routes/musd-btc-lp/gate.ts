import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import {
  aboveCap,
  AMOUNT_TOO_SMALL,
  FEE_MISMATCH,
  INSUFFICIENT_BALANCE,
  needsGas,
  noExecutor,
  PRICE_IMPACT,
  QUOTE_EXPIRED,
  wrongNetwork,
} from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { EntryQuote } from "@/lib/quote/entry";

/** 5% (PRODUCT_SPEC §12, provisional until integration tests); 1e18 = 100%. */
export const PRICE_IMPACT_LIMIT = 50_000_000_000_000_000n;
/** A quote's lifetime (PRODUCT_SPEC §12). */
export const QUOTE_TTL_MS = 60_000;

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
  | "quote-expired";

/** `outcome` is null when the button simply stays disabled (no amount yet). */
export type EntryBlock = { reason: EntryBlockReason; outcome: Outcome | null };

/** Why entry is blocked; the first matching reason wins (FR-01, FR-05, FR-22). */
export function entryBlock(input: EntryGateInput): EntryBlock | null {
  const { network, quote } = input;
  const block = (reason: EntryBlockReason, outcome: Outcome | null): EntryBlock => ({ reason, outcome });
  if (!network.executor) return block("no-executor", noExecutor(network));
  if (input.chainFeeBps !== network.executor.feeBps) return block("fee-mismatch", FEE_MISMATCH);
  if (writeBlocker(network, input.walletChainId) === "wrong-network") return block("wrong-network", wrongNetwork(network));
  if (input.musdIn === null) return block("zero", null);
  if (input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
  if (input.musdIn > input.maxMusdIn) return block("above-cap", aboveCap(network));
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
