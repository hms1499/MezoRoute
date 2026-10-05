import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlockerMessage } from "@/lib/config/write-gate";
import type { Outcome } from "./types";

// Messages follow PRODUCT_SPEC.md §13.

export const REJECTED: Outcome = { kind: "rejected", message: "Transaction was not signed.", recovery: ["retry"] };

export const RELAY: Outcome = {
  kind: "relay",
  message: "Mezo's relayer could not submit the transaction. Retry in a moment.",
  recovery: ["retry"],
};

export const SMART_ACCOUNT_REVERTED: Outcome = {
  kind: "smart-account-reverted",
  message: "Your smart account sent the transaction, but the call reverted.",
  recovery: ["retry", "copy-details"],
};

export const UNCONFIRMED: Outcome = {
  kind: "unconfirmed",
  message: "Your transaction was sent but is not confirmed yet. Check it in the explorer before trying again.",
  recovery: ["view-transaction"],
};

export const ACCOUNT_CHANGED: Outcome = {
  kind: "account-changed",
  message: "Your wallet account changed. Review and try again.",
  recovery: ["retry"],
};

export const QUOTE_EXPIRED: Outcome = {
  kind: "quote-expired",
  message: "Pool state changed; refresh your quote.",
  recovery: ["refresh-quote"],
};

export const SLIPPAGE: Outcome = { kind: "slippage", message: "Output fell below your minimum.", recovery: ["refresh-quote"] };

export const AMOUNT_TOO_SMALL: Outcome = {
  kind: "amount-too-small",
  message: "Amount is too small to route.",
  recovery: ["reduce-amount"],
};

export const ALLOWANCE: Outcome = {
  kind: "allowance",
  message: "The approval does not cover this amount.",
  recovery: ["retry"],
};

export const INSUFFICIENT_BALANCE: Outcome = {
  kind: "insufficient-balance",
  message: "Amount exceeds your available MUSD.",
  recovery: ["reduce-amount"],
};

export const POOL: Outcome = {
  kind: "pool",
  message: "The pool cannot take this trade right now.",
  recovery: ["refresh-quote"],
};

export const PRICE_UNAVAILABLE: Outcome = {
  kind: "price-unavailable",
  message: "The BTC price feed is temporarily unavailable.",
  recovery: ["retry"],
};

export const REVERTED: Outcome = { kind: "reverted", message: "The transaction reverted.", recovery: ["retry", "copy-details"] };

export const UNKNOWN: Outcome = { kind: "unknown", message: "Something went wrong.", recovery: ["retry", "copy-details"] };

export function wrongNetwork(network: NetworkConfig): Outcome {
  return { kind: "wrong-network", message: writeBlockerMessage("wrong-network", network), recovery: ["switch-network"] };
}

export function needsGas(network: NetworkConfig): Outcome {
  return network.faucetUrl
    ? { kind: "needs-gas", message: "You need test BTC to submit transactions.", recovery: ["add-gas"] }
    : { kind: "needs-gas", message: "You need BTC on Mezo to pay for gas.", recovery: [] };
}

export function rpcUnavailable(network: NetworkConfig): Outcome {
  return { kind: "rpc-unavailable", message: `${network.name} is temporarily unavailable.`, recovery: ["retry"] };
}

export function aboveCap(network: NetworkConfig): Outcome {
  return {
    kind: "above-cap",
    message:
      network.id === "mainnet"
        ? "Mainnet deposits are limited to 1,000 MUSD per transaction while unaudited."
        : "Amount is above the per-transaction cap.",
    recovery: ["reduce-amount"],
  };
}
