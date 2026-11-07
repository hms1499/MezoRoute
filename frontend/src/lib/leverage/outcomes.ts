import type { NetworkConfig } from "@/lib/config/networks";
import {
  BELOW_MIN_DEBT,
  CAPACITY_SHORT,
  EVM_ONLY,
  HAS_TROVE,
  INSUFFICIENT_BALANCE,
  LEVERAGE_NOT_DEPLOYED,
  leverageCapOutcome,
  NO_TROVE,
  ORACLE_BOUND,
  QUOTE_EXPIRED,
  TROVE_RECOVERY_MODE,
  wrongNetwork,
} from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import type { TroveBlockReason } from "./gate";

/** The fixed message for each block reason; null where the page shows its own prompt (no quote yet). */
export function troveBlockOutcome(reason: TroveBlockReason, network: NetworkConfig): Outcome | null {
  switch (reason) {
    case "not-deployed":
      return LEVERAGE_NOT_DEPLOYED;
    case "wrong-network":
      return wrongNetwork(network);
    case "smart-account":
      return EVM_ONLY;
    case "recovery-mode":
      return TROVE_RECOVERY_MODE;
    case "no-trove":
      return NO_TROVE;
    case "has-trove":
      return HAS_TROVE;
    case "stale-quote":
      return QUOTE_EXPIRED;
    case "insufficient-btc":
      return INSUFFICIENT_BALANCE;
    case "no-quote":
      return null;
    case "below-min-debt":
      return BELOW_MIN_DEBT;
    case "above-cap":
      return leverageCapOutcome(network);
    case "capacity":
      return CAPACITY_SHORT;
    case "oracle-bound":
      return ORACLE_BOUND;
  }
}
