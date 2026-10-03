/** The relayer answered without a usable transaction hash, so nothing was submitted. */
export class RelayError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RelayError";
  }
}

/** The relayed Safe transaction confirmed, but the call inside it reverted (Safe ExecutionFailure). */
export class SmartAccountCallFailedError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(`The smart-account call reverted inside relayed transaction ${hash}`);
    this.name = "SmartAccountCallFailedError";
    this.hash = hash;
  }
}

export type SendErrorKind = "rejected" | "needs-gas" | "relay" | "reverted" | "unknown";

/**
 * Messages and codes along the cause chain. Wallets do not always throw Error instances:
 * OrangeKit's Xverse provider throws a plain `{ code, message }` object.
 */
function errorChain(error: unknown): { messages: string[]; codes: unknown[] } {
  const messages: string[] = [];
  const codes: unknown[] = [];
  let current: unknown = error;
  for (let depth = 0; typeof current === "object" && current !== null && depth < 6; depth++) {
    const { message, code, cause } = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof message === "string") messages.push(message);
    if (code !== undefined) codes.push(code);
    current = cause;
  }
  return { messages, codes };
}

/** EIP-1193 "user rejected request". */
const USER_REJECTED = 4001;

/** Minimal mapping for the spike; F1 builds the full decoder (spec §13). */
export function classifySendError(error: unknown): { kind: SendErrorKind; message: string } {
  if (error instanceof RelayError) {
    return { kind: "relay", message: "Mezo's relayer could not submit the transaction. Retry in a moment." };
  }
  if (error instanceof SmartAccountCallFailedError) {
    return { kind: "reverted", message: "Your smart account sent the transaction, but the call reverted." };
  }
  const { messages, codes } = errorChain(error);
  const text = messages.join(" | ");
  if (codes.includes(USER_REJECTED) || /user rejected|user denied|user cancel|rejected the request/i.test(text)) {
    return { kind: "rejected", message: "Transaction was not signed." };
  }
  if (/not enough native token balance|insufficient funds/i.test(text)) {
    return { kind: "needs-gas", message: "You need test BTC to submit transactions." };
  }
  return { kind: "unknown", message: messages[0] ?? String(error) };
}

// What OrangeKit raises when Mezo's relayer fails before a hash exists: a non-JSON body
// (MezoTransactionSender parses the response without checking its status), a network or CORS
// failure, or the deploy relayer's "0x" hash, which OrangeKit then looks up on the RPC.
const RELAY_FAILURE = /is not valid JSON|unexpected token|failed to fetch|networkerror|load failed|hex string has length 0/i;

/** For OrangeKit (Bitcoin-wallet) connectors, re-labels relayer failures as RelayError. */
export function asRelayFailure(error: unknown, connectorType: string | undefined): unknown {
  if (connectorType !== "orangekit" || error instanceof RelayError) return error;
  const { messages } = errorChain(error);
  if (!RELAY_FAILURE.test(messages.join(" | "))) return error;
  return new RelayError(`Mezo's relayer failed: ${messages[0]}`, { cause: error });
}
