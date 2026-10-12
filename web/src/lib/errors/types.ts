import type { Hash } from "viem";

/** What the user can do about an error; the toast renders one button per recovery (spec §13, FR-14). */
export type Recovery =
  | "retry"
  | "refresh-quote"
  | "switch-network"
  | "add-gas"
  | "reduce-amount"
  | "copy-details"
  | "view-transaction"
  | "use-deposit";

export type ErrorKind =
  | "rejected"
  | "relay"
  | "smart-account-reverted"
  | "unconfirmed"
  | "wrong-network"
  | "account-changed"
  | "needs-gas"
  | "quote-expired"
  | "slippage"
  | "above-cap"
  | "amount-too-small"
  | "allowance"
  | "insufficient-balance"
  | "pool"
  | "price-unavailable"
  | "no-executor"
  | "fee-mismatch"
  | "price-impact"
  | "replaced"
  | "permit-expired"
  | "smart-account-borrow"
  | "no-trove"
  | "recovery-mode"
  | "cr-floor"
  | "above-headroom"
  | "borrow-used"
  | "signature-invalid"
  | "reverted"
  | "rpc-unavailable"
  | "unknown";

/** A user-facing outcome: always one of the fixed messages, never raw error text. */
export type Outcome = { kind: ErrorKind; message: string; recovery: Recovery[] };

/** `details` is what "Copy details" copies; `hash` is set when a transaction was submitted. */
export type DecodedError = Outcome & { details?: string; hash?: Hash };
