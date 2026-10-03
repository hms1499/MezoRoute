/** The relayer answered without a usable transaction hash, so nothing was submitted. */
export class RelayError extends Error {
  constructor(message: string) {
    super(message);
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

function messageChain(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 6; depth++) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages;
}

/** Minimal mapping for the spike; F1 builds the full decoder (spec §13). */
export function classifySendError(error: unknown): { kind: SendErrorKind; message: string } {
  if (error instanceof RelayError) {
    return { kind: "relay", message: "Mezo's relayer did not accept the transaction. Retry in a moment." };
  }
  if (error instanceof SmartAccountCallFailedError) {
    return { kind: "reverted", message: "Your smart account sent the transaction, but the call reverted." };
  }
  const messages = messageChain(error);
  const text = messages.join(" | ");
  if (/user rejected|user denied|rejected the request|cancel/i.test(text)) {
    return { kind: "rejected", message: "Transaction was not signed." };
  }
  if (/not enough native token balance|insufficient funds/i.test(text)) {
    return { kind: "needs-gas", message: "You need test BTC to submit transactions." };
  }
  return { kind: "unknown", message: messages[0] ?? String(error) };
}
