import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlockerMessage } from "@/lib/config/write-gate";
import type { Outcome } from "./types";

// Messages follow PRODUCT_SPEC.md §13.

export const REJECTED: Outcome = { kind: "rejected", message: "You cancelled this in your wallet.", recovery: ["retry"] };

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

export const FEE_MISMATCH: Outcome = {
  kind: "fee-mismatch",
  message: "This MezoRoute deployment does not match the app. Reload the page.",
  recovery: ["retry"],
};

export const PRICE_IMPACT: Outcome = {
  kind: "price-impact",
  message: "This trade would lose too much value at current liquidity.",
  recovery: ["reduce-amount"],
};

export const REPLACED: Outcome = {
  kind: "replaced",
  message: "Your transaction was replaced in your wallet. Check it before trying again.",
  recovery: ["view-transaction"],
};

export const PERMIT_EXPIRED: Outcome = {
  kind: "permit-expired",
  message: "Your signature expired. Sign again.",
  recovery: ["retry"],
};

export const SMART_ACCOUNT_BORROW: Outcome = {
  kind: "smart-account-borrow",
  message: "Borrow & Deploy needs a standard wallet signature.",
  recovery: [],
};

export const NO_TROVE: Outcome = {
  kind: "no-trove",
  message: "You need an open Trove to borrow. Open one in the Mezo app.",
  recovery: [],
};

export const RECOVERY_MODE: Outcome = {
  kind: "recovery-mode",
  message: "Borrowing is paused while Mezo is in Recovery Mode.",
  recovery: [],
};

export const CR_FLOOR: Outcome = {
  kind: "cr-floor",
  message: "This borrow would leave your Trove too close to liquidation.",
  recovery: ["reduce-amount"],
};

export const ABOVE_HEADROOM: Outcome = {
  kind: "above-headroom",
  message: "Amount exceeds what your Trove can safely borrow.",
  recovery: ["reduce-amount"],
};

export const BORROW_USED: Outcome = {
  kind: "borrow-used",
  message: "Your borrow authorisation was already used; the MUSD is in your wallet.",
  recovery: ["use-deposit"],
};

export const SIGNATURE_INVALID: Outcome = {
  kind: "signature-invalid",
  message: "Your borrow authorisation is no longer valid. Sign again.",
  recovery: ["retry"],
};

export const NO_LP: Outcome = { kind: "no-lp", message: "You have no MUSD/BTC LP to exit.", recovery: [] };

export const LP_CHANGED: Outcome = {
  kind: "lp-changed",
  message: "Your LP balance changed. Review the exit again.",
  recovery: ["reduce-amount"],
};

export const NOTHING_TO_CLAIM: Outcome = { kind: "nothing-to-claim", message: "You have no fees to claim yet.", recovery: [] };

// Stability Pool (F5); the blocked-withdrawal message is PRODUCT_SPEC §13's.
export const SP_WITHDRAW_BLOCKED: Outcome = {
  kind: "sp-withdraw-blocked",
  message: "Withdrawals are paused while some Troves are under-collateralised.",
  recovery: ["retry"],
};

export const NO_SP_DEPOSIT: Outcome = { kind: "no-sp-deposit", message: "You have no Stability Pool deposit.", recovery: [] };

export const NO_SP_GAIN: Outcome = { kind: "nothing-to-claim", message: "You have no BTC gain to claim yet.", recovery: [] };

export const REVERTED: Outcome = { kind: "reverted", message: "The transaction reverted.", recovery: ["retry", "copy-details"] };

export const UNKNOWN: Outcome = { kind: "unknown", message: "Something went wrong.", recovery: ["retry", "copy-details"] };

export function wrongNetwork(network: NetworkConfig): Outcome {
  return { kind: "wrong-network", message: writeBlockerMessage("wrong-network", network), recovery: ["switch-network"] };
}

export function noExecutor(network: NetworkConfig): Outcome {
  return { kind: "no-executor", message: writeBlockerMessage("no-executor", network), recovery: [] };
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
