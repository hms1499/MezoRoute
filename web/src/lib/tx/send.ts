import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { getAccount, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { causeChain, chainNames, findRevertData } from "@/lib/errors/chain";
import {
  asRelayFailure,
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionRevertedError,
} from "./errors";
import { hasSafeExecutionFailure } from "./safe";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Mezo's relayer reports failure as hash "0x" instead of throwing (OrangeKit MezoTransactionSender). */
export function assertTxHash(value: unknown): Hash {
  if (typeof value !== "string" || !TX_HASH.test(value)) {
    throw new RelayError(`The wallet returned no transaction hash (${String(value)}); nothing was submitted.`);
  }
  return value as Hash;
}

/** The account and chain a flow started with; every step of the flow sends with the same pin. */
export type SendPin = { account: Address; chainId: number };

const REVERT_NAMES = new Set(["CallExecutionError", "ExecutionRevertedError", "ContractFunctionRevertedError"]);
const TRANSPORT_NAMES = new Set(["HttpRequestError", "TimeoutError", "WebSocketRequestError", "RpcRequestError"]);

/**
 * Classifies a failure while waiting for the receipt of a submitted transaction. wagmi replays a
 * reverted transaction with `call` and throws either that call's revert or `Error(reason)`. A
 * timeout or an RPC failure says nothing about the outcome, so it must not be reported as a revert
 * (a retry could send twice). Revert markers are checked before transport names because a replayed
 * revert also carries an RpcRequestError.
 */
export function receiptFailure(error: unknown, hash: Hash): TransactionRevertedError | ConfirmationTimeoutError {
  const chain = causeChain(error);
  const names = chainNames(chain);
  if (names.includes("WaitForTransactionReceiptTimeoutError")) return new ConfirmationTimeoutError(hash, { cause: error });
  if (findRevertData(chain) || names.some((name) => REVERT_NAMES.has(name))) {
    return new TransactionRevertedError(hash, { cause: error });
  }
  if (names.some((name) => TRANSPORT_NAMES.has(name))) return new ConfirmationTimeoutError(hash, { cause: error });
  return new TransactionRevertedError(hash, { cause: error });
}

/**
 * Sends one call from the connected wallet and waits for a successful receipt. The same path
 * serves EOAs and OrangeKit smart accounts: wagmi resolves `sendTransaction` to OrangeKit's
 * Safe-relaying override for Bitcoin wallets.
 */
export async function sendCall(config: Config, call: { to: Address; data: Hex }, pin: SendPin): Promise<TransactionReceipt> {
  const connectorType = getAccount(config).connector?.type;
  let sent: unknown;
  try {
    // With account and chain pinned, wagmi throws (ConnectorAccountNotFoundError,
    // ConnectorChainMismatchError) instead of sending from an account or chain the user switched
    // to after the flow started.
    sent = await sendTransaction(config, { to: call.to, data: call.data, account: pin.account, chainId: pin.chainId });
  } catch (error) {
    throw asRelayFailure(error, connectorType);
  }
  const hash = assertTxHash(sent);
  let receipt: TransactionReceipt;
  try {
    // The public testnet RPC intermittently returns null receipts; viem keeps polling until the timeout.
    receipt = await waitForTransactionReceipt(config, {
      hash,
      chainId: pin.chainId,
      pollingInterval: 2_000,
      timeout: 120_000,
    });
  } catch (error) {
    throw receiptFailure(error, hash);
  }
  if (receipt.status !== "success") throw new TransactionRevertedError(hash);
  if (hasSafeExecutionFailure(receipt.logs)) throw new SmartAccountCallFailedError(hash);
  return receipt;
}
