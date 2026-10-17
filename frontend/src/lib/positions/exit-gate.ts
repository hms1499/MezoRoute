import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { AMOUNT_TOO_SMALL, LP_CHANGED, needsGas, NO_LP, noExecutor, PRICE_IMPACT, QUOTE_EXPIRED, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { ExitQuote } from "@/lib/quote/exit";
import { PRICE_IMPACT_LIMIT, QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";

export type ExitBlockReason =
  | "no-executor"
  | "wrong-network"
  | "no-lp"
  | "lp-changed"
  | "too-small"
  | "price-impact"
  | "needs-gas"
  | "quote-expired";
export type ExitBlock = { reason: ExitBlockReason; outcome: Outcome | null };

export type ExitGateInput = {
  network: NetworkConfig;
  walletChainId: number | undefined;
  lpBalance: bigint;
  liquidityIn: bigint;
  quote: ExitQuote | null;
  lacksGas: boolean;
  quoteAgeMs: number;
};

/** Why exit is blocked; the first matching reason wins (Flow G, FR-09). Exit is never capped (FR-22). */
export function exitBlock(input: ExitGateInput): ExitBlock | null {
  const { network } = input;
  const block = (reason: ExitBlockReason, outcome: Outcome | null): ExitBlock => ({ reason, outcome });
  const blocker = writeBlocker(network, input.walletChainId);
  if (blocker === "no-executor") return block("no-executor", noExecutor(network));
  if (blocker === "wrong-network") return block("wrong-network", wrongNetwork(network));
  if (input.lpBalance === 0n) return block("no-lp", NO_LP);
  if (input.liquidityIn > input.lpBalance) return block("lp-changed", LP_CHANGED);
  if (!input.quote) return block("too-small", AMOUNT_TOO_SMALL);
  if (input.quote.priceImpact > PRICE_IMPACT_LIMIT) return block("price-impact", PRICE_IMPACT);
  if (input.lacksGas) return block("needs-gas", needsGas(network));
  if (input.quoteAgeMs > QUOTE_TTL_MS) return block("quote-expired", QUOTE_EXPIRED);
  return null;
}
