import type { Hash } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import {
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionRevertedError,
} from "@/lib/tx/errors";
import { causeChain, chainCodes, chainMessages, chainNames, findRevertData, type ChainLink } from "./chain";
import { customErrorOutcome } from "./custom-errors";
import {
  ACCOUNT_CHANGED,
  needsGas,
  REJECTED,
  RELAY,
  REVERTED,
  rpcUnavailable,
  SMART_ACCOUNT_REVERTED,
  UNCONFIRMED,
  UNKNOWN,
  wrongNetwork,
} from "./outcomes";
import { decodeRevertData } from "./revert-data";
import { revertStringOutcome } from "./revert-strings";
import type { DecodedError, Outcome } from "./types";

/** EIP-1193 "user rejected request". */
const USER_REJECTED = 4001;
const REJECTED_TEXT = /user rejected|user denied|user cancel|rejected the request/i;
// viem's "insufficient funds for gas * price + value" and OrangeKit's empty-Safe message.
const NEEDS_GAS_TEXT = /insufficient funds|not enough native token balance/i;
const REVERT_NAMES = ["ContractFunctionRevertedError", "CallExecutionError", "ExecutionRevertedError", "TransactionRevertedError"];
const REVERT_TEXT = /execution reverted/i;
const RPC_DOWN_NAMES = ["HttpRequestError", "TimeoutError", "WebSocketRequestError"];
const RPC_DOWN_TEXT = /failed to fetch|networkerror|load failed/i;

/** "Copy details" stays short enough to paste into a chat. */
export const MAX_DETAILS = 300;

/**
 * Maps any wallet, relayer, RPC, or revert error to a fixed message and recovery actions
 * (PRODUCT_SPEC.md §13). The first matching rule wins; the order is the F1 design's rule table.
 */
export function decodeError(error: unknown, network: NetworkConfig): DecodedError {
  const chain = causeChain(error);
  const names = chainNames(chain);
  const messages = chainMessages(chain);
  const text = messages.join(" | ");
  const hash = transactionHash(chain);
  const result = (outcome: Outcome, detail?: string) => withDetails(outcome, detail, hash);

  if (chainCodes(chain).includes(USER_REJECTED) || REJECTED_TEXT.test(text)) return result(REJECTED);
  if (chain.some((link) => link instanceof RelayError)) return result(RELAY);
  if (chain.some((link) => link instanceof SmartAccountCallFailedError)) return result(SMART_ACCOUNT_REVERTED);
  if (chain.some((link) => link instanceof ConfirmationTimeoutError)) return result(UNCONFIRMED);
  if (names.includes("ConnectorChainMismatchError")) return result(wrongNetwork(network));
  if (names.includes("ConnectorAccountNotFoundError")) return result(ACCOUNT_CHANGED);
  if (NEEDS_GAS_TEXT.test(text)) return result(needsGas(network));

  const data = findRevertData(chain);
  if (data) {
    const revert = decodeRevertData(data);
    if (revert.type === "custom") return result(customErrorOutcome(revert.name, network) ?? REVERTED, revert.name);
    if (revert.type === "string") return result(revertStringOutcome(revert.reason) ?? REVERTED, revert.reason);
    return result(REVERTED, `Unknown error ${revert.selector}`);
  }
  const fromText = revertStringOutcome(text);
  if (fromText) return result(fromText);
  const rpcDown = names.some((name) => RPC_DOWN_NAMES.includes(name)) || RPC_DOWN_TEXT.test(text);
  // Without a hash nothing was mined: a read or simulation that never reached a node is an outage,
  // even though viem wraps it in CallExecutionError.
  if (rpcDown && !hash) return result(rpcUnavailable(network));
  if (names.some((name) => REVERT_NAMES.includes(name)) || REVERT_TEXT.test(text)) {
    // With a hash, the hash is the useful detail; the message would only repeat it.
    return result(REVERTED, hash ? undefined : messages[0]);
  }
  if (rpcDown) return result(rpcUnavailable(network));
  return result(UNKNOWN, messages[0] ?? String(error));
}

function transactionHash(chain: readonly ChainLink[]): Hash | undefined {
  for (const link of chain) {
    if (
      link instanceof SmartAccountCallFailedError ||
      link instanceof TransactionRevertedError ||
      link instanceof ConfirmationTimeoutError
    ) {
      return link.hash;
    }
  }
  return undefined;
}

function withDetails(outcome: Outcome, detail: string | undefined, hash: Hash | undefined): DecodedError {
  // The hash goes first so that truncation never cuts it off.
  const lines = [hash && `Transaction ${hash}`, detail].filter((line): line is string => Boolean(line));
  const decoded: DecodedError = { ...outcome, recovery: [...outcome.recovery] };
  if (lines.length > 0) decoded.details = shorten(lines.join("\n"), MAX_DETAILS);
  if (hash) decoded.hash = hash;
  return decoded;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
