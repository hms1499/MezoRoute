import type { Hash } from "viem";
import { causeChain, chainMessages } from "@/lib/errors/chain";

/** The relayer answered without a usable transaction hash, so nothing was submitted. */
export class RelayError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RelayError";
  }
}

/** The relayed Safe transaction confirmed, but the call inside it reverted (Safe ExecutionFailure). */
export class SmartAccountCallFailedError extends Error {
  readonly hash: Hash;

  constructor(hash: Hash) {
    super(`The smart-account call reverted inside relayed transaction ${hash}`);
    this.name = "SmartAccountCallFailedError";
    this.hash = hash;
  }
}

/** The transaction was mined and reverted (or wagmi's replay of it failed). */
export class TransactionRevertedError extends Error {
  readonly hash: Hash;

  constructor(hash: Hash, options?: { cause?: unknown }) {
    super(`Transaction ${hash} reverted`, options);
    this.name = "TransactionRevertedError";
    this.hash = hash;
  }
}

/** The transaction was submitted, but no receipt arrived in time or the RPC failed while waiting: the outcome is unknown. */
export class ConfirmationTimeoutError extends Error {
  readonly hash: Hash;

  constructor(hash: Hash, options?: { cause?: unknown }) {
    super(`Transaction ${hash} is not confirmed yet`, options);
    this.name = "ConfirmationTimeoutError";
    this.hash = hash;
  }
}

// What OrangeKit raises when Mezo's relayer fails before a hash exists: a non-JSON body
// (MezoTransactionSender parses the response without checking its status), a network or CORS
// failure, or the deploy relayer's "0x" hash, which OrangeKit then looks up on the RPC.
const RELAY_FAILURE = /is not valid JSON|unexpected token|failed to fetch|networkerror|load failed|hex string has length 0/i;

/** For OrangeKit (Bitcoin-wallet) connectors, re-labels relayer failures as RelayError. */
export function asRelayFailure(error: unknown, connectorType: string | undefined): unknown {
  if (connectorType !== "orangekit" || error instanceof RelayError) return error;
  const messages = chainMessages(causeChain(error));
  if (!RELAY_FAILURE.test(messages.join(" | "))) return error;
  return new RelayError(`Mezo's relayer failed: ${messages[0]}`, { cause: error });
}
