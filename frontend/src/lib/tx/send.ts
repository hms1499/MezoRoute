import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { estimateGas, getAccount, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { causeChain, chainNames, findRevertData } from "@/lib/errors/chain";
import { gasLimit } from "@/lib/quote/gas";
import { isOrangeKitConnector } from "@/lib/wallet/capabilities";
import {
  asRelayFailure,
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionReplacedError,
  TransactionRevertedError,
} from "./errors";
import { hasSafeExecutionFailure } from "./safe";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export function isTxHash(value: unknown): value is Hash {
  return typeof value === "string" && TX_HASH.test(value);
}

/** Mezo's relayer reports failure as hash "0x" instead of throwing (OrangeKit MezoTransactionSender). */
export function assertTxHash(value: unknown): Hash {
  if (!isTxHash(value)) {
    throw new RelayError(`The wallet returned no transaction hash (${String(value)}); nothing was submitted.`);
  }
  return value;
}

/** The account and chain a flow started with; every step of the flow sends with the same pin. */
export type SendPin = { account: Address; chainId: number };

const REVERT_NAMES = new Set(["CallExecutionError", "ExecutionRevertedError", "ContractFunctionRevertedError"]);

/**
 * Classifies a failure while waiting for the receipt of a submitted transaction. Only positive
 * evidence makes it a revert: wagmi replays a reverted transaction with `call` and throws either
 * that call's revert (revert data or names) or a plain `Error(reason)`. Everything else (timeouts,
 * RPC failures, viem's TransactionReceiptNotFoundError or BlockNotFoundError after a null receipt
 * from the flaky testnet RPC) says nothing about the outcome, so it is reported as unconfirmed:
 * offering a retry there could send twice.
 */
export function receiptFailure(error: unknown, hash: Hash): TransactionRevertedError | ConfirmationTimeoutError {
  const chain = causeChain(error);
  const names = chainNames(chain);
  if (names.includes("WaitForTransactionReceiptTimeoutError")) return new ConfirmationTimeoutError(hash, { cause: error });
  const replayReverted = findRevertData(chain) !== undefined || names.some((name) => REVERT_NAMES.has(name));
  const wagmiReplayError = error instanceof Error && Object.getPrototypeOf(error) === Error.prototype;
  if (replayReverted || wagmiReplayError) return new TransactionRevertedError(hash, { cause: error });
  return new ConfirmationTimeoutError(hash, { cause: error });
}

/**
 * Sends one call from the connected wallet and returns its hash. The same path serves EOAs and
 * OrangeKit smart accounts: wagmi resolves `sendTransaction` to OrangeKit's Safe-relaying override
 * for Bitcoin wallets. With a `gasBudget`, an EVM wallet gets an explicit gas limit (`gasLimit`: the
 * estimate plus 20%, never below the budget); a smart account's gas is left to the relayer.
 */
export async function submitCall(
  config: Config,
  call: { to: Address; data: Hex },
  pin: SendPin,
  gasBudget?: bigint,
): Promise<Hash> {
  const connector = getAccount(config).connector;
  const connectorType = connector?.type;
  const gas =
    gasBudget === undefined || (connector && isOrangeKitConnector(connector))
      ? undefined
      : gasLimit(
          gasBudget,
          await estimateGas(config, { to: call.to, data: call.data, account: pin.account, chainId: pin.chainId }).catch(() => undefined),
        );
  let sent: unknown;
  try {
    // With account and chain pinned, wagmi throws (ConnectorAccountNotFoundError,
    // ConnectorChainMismatchError) instead of sending from an account or chain the user switched
    // to after the flow started.
    sent = await sendTransaction(config, {
      to: call.to,
      data: call.data,
      account: pin.account,
      chainId: pin.chainId,
      ...(gas === undefined ? {} : { gas }),
    });
  } catch (error) {
    throw asRelayFailure(error, connectorType);
  }
  return assertTxHash(sent);
}

/** How long to wait for a receipt in total, and the pause before asking again after a flaky-RPC miss. */
const CONFIRM_TIMEOUT_MS = 120_000;
const RETRY_PAUSE_MS = 2_000;

/**
 * Waits for a submitted transaction's successful receipt; also serves the receipt page after a reload.
 * The public testnet RPC sometimes answers null for a mined transaction's receipt and block, which
 * makes viem give up early; such a miss is retried until the overall timeout.
 */
export async function confirmCall(config: Config, hash: Hash, chainId: number): Promise<TransactionReceipt> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  let replacement: { reason: string; transaction: { hash: Hash } } | undefined;
  let receipt: TransactionReceipt;
  for (;;) {
    try {
      receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId,
        pollingInterval: RETRY_PAUSE_MS,
        timeout: Math.max(deadline - Date.now(), 1),
        onReplaced: (replaced) => {
          replacement = replaced;
        },
      });
      break;
    } catch (error) {
      const failure = receiptFailure(error, hash);
      const viemTimedOut = chainNames(causeChain(error)).includes("WaitForTransactionReceiptTimeoutError");
      if (!(failure instanceof ConfirmationTimeoutError) || viemTimedOut || Date.now() + RETRY_PAUSE_MS >= deadline) {
        throw failure;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
  }
  // viem follows a replacement and resolves with its receipt; only a repriced copy is the same call.
  if (replacement && replacement.reason !== "repriced") {
    throw new TransactionReplacedError(hash, replacement.transaction.hash);
  }
  if (receipt.status !== "success") throw new TransactionRevertedError(receipt.transactionHash);
  if (hasSafeExecutionFailure(receipt.logs)) throw new SmartAccountCallFailedError(receipt.transactionHash);
  return receipt;
}

/** Submit, then confirm: used for steps that must finish before the next one (the approval). */
export async function sendCall(
  config: Config,
  call: { to: Address; data: Hex },
  pin: SendPin,
  gasBudget?: bigint,
): Promise<TransactionReceipt> {
  return confirmCall(config, await submitCall(config, call, pin, gasBudget), pin.chainId);
}
