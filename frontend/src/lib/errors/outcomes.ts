import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlockerMessage } from "@/lib/config/write-gate";
import { GAUGE_READ_FAILED_RETRY } from "@/lib/gauge/copy";
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

/** A BTC entry: BTC is also the gas, so a BTC amount can fail on the wallet's own balance. */
export const INSUFFICIENT_BTC: Outcome = {
  kind: "insufficient-balance",
  message: "Amount exceeds your available BTC.",
  recovery: ["reduce-amount"],
};

/** The amount fits the balance but leaves too little BTC to pay for the transaction. */
export const KEEP_GAS_BTC: Outcome = {
  kind: "needs-gas",
  message: "Keep some BTC in your wallet to pay for the network fee. Enter a little less.",
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

export const NOTHING_TO_CLAIM: Outcome = { kind: "nothing-to-claim", message: "You have no fees to claim yet.", recovery: [], tone: "neutral" };

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

export function aboveCapBtc(network: NetworkConfig): Outcome {
  return {
    kind: "above-cap",
    message:
      network.id === "mainnet"
        ? "Mainnet deposits are limited to 0.0125 BTC per transaction while unaudited."
        : "Amount is above the per-transaction cap.",
    recovery: ["reduce-amount"],
  };
}

export const STAKING_CLOSED: Outcome = {
  kind: "staking-closed",
  message: "Staking is closed; enter without staking",
  recovery: ["skip-stake"],
};

/** The executor's stake check tripped (`StakeNotCredited`, `StakeIncomplete`); the revert undoes the whole entry. */
export const STAKE_FAILED: Outcome = {
  kind: "stake-failed",
  message: "Staking did not go through, so nothing moved. Try again or enter without staking.",
  recovery: ["retry", "skip-stake"],
};

export const BORROW_MISMATCH: Outcome = {
  kind: "borrow-mismatch",
  message: "The borrow does not match this deposit. Review it again.",
  recovery: ["reduce-amount"],
};

/** A safety check of the executor refused the call; the app's own calls should never reach these. */
export const ROUTE_REFUSED: Outcome = {
  kind: "route-refused",
  message: "MezoRoute refused this transaction, so nothing moved.",
  recovery: ["retry", "copy-details"],
};

export const GAUGE_READ_FAILED: Outcome = { kind: "gauge-read-failed", message: GAUGE_READ_FAILED_RETRY, recovery: ["retry"] };

// Gauge actions on Positions (G1).
export const NO_PENDING_MEZO: Outcome = { kind: "nothing-to-claim", message: "You have no MEZO to claim yet.", recovery: [] };
export const NO_WALLET_LP: Outcome = { kind: "no-lp", message: "You have no LP in your wallet to stake.", recovery: [] };
export const NO_STAKED_LP: Outcome = { kind: "no-staked-lp", message: "You have no staked LP.", recovery: [] };
export const STAKING_CLOSED_NOW: Outcome = {
  kind: "staking-closed",
  message: "Staking is closed right now. You can still claim and unstake.",
  recovery: [],
};

// L1 (Unwind, Close, Leverage, Open with leverage). Copy in src/lib/leverage/copy.ts.

export const TROVE_AUTH_USED: Outcome = {
  kind: "trove-auth-used",
  message: "Your Trove authorisation was already used or replaced. Sign again.",
  recovery: ["retry"],
};

export const PRICE_MOVED: Outcome = {
  kind: "price-moved",
  message: "The pool price moved; review the new quote.",
  recovery: ["refresh-quote"],
};

export const CAPACITY_SHORT: Outcome = {
  kind: "capacity-short",
  message: "Your Trove's borrowing capacity is too low for this, even after a refinance. Choose a higher target ratio.",
  recovery: ["reduce-amount"],
};

export const BELOW_MIN_DEBT: Outcome = {
  kind: "below-min-debt",
  message: "This would leave less than the 1,800 MUSD minimum debt. Close the Trove instead.",
  recovery: ["reduce-amount"],
};

export const TROVE_RECOVERY_MODE: Outcome = {
  kind: "trove-recovery-mode",
  message:
    "Mezo is in Recovery Mode: the protocol does not allow withdrawing collateral or closing a Trove until the system ratio is back above 150%.",
  recovery: [],
};

export const EVM_ONLY: Outcome = {
  kind: "evm-only",
  message: "Trove authorisations need an EVM wallet such as MetaMask. Bitcoin wallets can claim surplus BTC and repay from the wallet.",
  recovery: [],
};

export const HAS_TROVE: Outcome = { kind: "has-trove", message: "You already have an open Trove; use Leverage instead.", recovery: [] };

export const LEVERAGE_NOT_DEPLOYED: Outcome = {
  kind: "leverage-not-deployed",
  message: "Trove actions are not available on this network yet.",
  recovery: [],
};

export const ORACLE_BOUND: Outcome = {
  kind: "oracle-bound",
  message: "The pool price is too far from Mezo's oracle for this size. Try a smaller amount.",
  recovery: ["reduce-amount"],
};

export function leverageCapOutcome(network: NetworkConfig): Outcome {
  const cap = network.leverage;
  return {
    kind: "above-cap",
    message:
      cap === null
        ? "Amount is above the per-transaction cap."
        : `MezoRoute caps each Trove action at ${formatCap(cap.maxBtcFlash)} BTC or ${formatCap(cap.maxMusdFlash)} MUSD per transaction.`,
    recovery: ["reduce-amount"],
  };
}

function formatCap(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}
