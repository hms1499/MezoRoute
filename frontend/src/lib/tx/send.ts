import { formatTransactionReceipt, type Address, type Hash, type Hex, type RpcTransactionReceipt, type TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { estimateGas, getAccount, getTransactionReceipt, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { causeChain, chainNames, findRevertData } from "@/lib/errors/chain";
import { networks } from "@/lib/config/networks";
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
/** How long a reverted receipt from the direct poll waits for viem's replay, which carries the revert reason. */
const REVERT_GRACE_MS = 5_000;

/**
 * Waits for a submitted transaction's successful receipt; also serves the receipt page after a reload.
 * The public testnet RPC sometimes answers null for a mined transaction's receipt and block, which
 * makes viem give up early; such a miss is retried until the overall timeout. It can also answer null
 * for eth_getTransactionByHash for minutes (19 Oct 2026), and viem then keeps asking for the transaction
 * without asking for the receipt again, so the receipt is also polled directly.
 */
export async function confirmCall(config: Config, hash: Hash, chainId: number): Promise<TransactionReceipt> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  const replaced: { value?: { reason: string; transaction: { hash: Hash } } } = {};
  const stop = { done: false };
  let receipt: TransactionReceipt;
  try {
    const viem = viemReceipt(config, hash, chainId, deadline, replaced);
    // If the direct poll wins, viem's wait still ends later (usually its timeout): don't leave that unhandled.
    viem.catch(() => {});
    const first = await Promise.race([
      viem.then((found) => ({ polled: false, found })),
      polledReceipt(config, hash, chainId, deadline, stop).then((found) => ({ polled: true, found })),
    ]);
    receipt = first.found;
    if (first.polled && receipt.status !== "success") {
      // viem replays a reverted call and throws with its revert data, which decodeError turns into advice
      // (slippage, expired quote): wait briefly for that before reporting a bare revert.
      const grace = Math.max(Math.min(REVERT_GRACE_MS, deadline - Date.now()), 0);
      const bare = receipt;
      receipt = await Promise.race([viem, new Promise<TransactionReceipt>((resolve) => setTimeout(() => resolve(bare), grace))]);
    }
  } finally {
    stop.done = true;
  }
  // viem follows a replacement and resolves with its receipt; only a repriced copy is the same call.
  const replacement = replaced.value;
  if (replacement && replacement.reason !== "repriced") {
    throw new TransactionReplacedError(hash, replacement.transaction.hash);
  }
  if (receipt.status !== "success") throw new TransactionRevertedError(receipt.transactionHash);
  if (hasSafeExecutionFailure(receipt.logs)) throw new SmartAccountCallFailedError(receipt.transactionHash);
  return receipt;
}

/**
 * Asks for the receipt itself every RETRY_PAUSE_MS until the deadline; never settles if none comes. When the
 * RPC answers null it also asks the explorer: the browser keeps one connection to the RPC, and that can stay
 * on a node that lacks the mined transaction (19 Oct 2026).
 */
async function polledReceipt(
  config: Config,
  hash: Hash,
  chainId: number,
  deadline: number,
  stop: { done: boolean },
): Promise<TransactionReceipt> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    if (stop.done || Date.now() >= deadline) return new Promise<never>(() => {});
    const receipt = (await getTransactionReceipt(config, { hash, chainId }).catch(() => null)) ?? (await explorerReceipt(hash, chainId));
    if (receipt) return receipt;
  }
}

/** The receipt from the explorer's (Blockscout) eth-rpc endpoint, or null. */
async function explorerReceipt(hash: Hash, chainId: number): Promise<TransactionReceipt | null> {
  const network = Object.values(networks).find((n) => n.chainId === chainId);
  if (!network) return null;
  try {
    const response = await fetch(`${network.explorerApiUrl}/api/eth-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
    });
    if (!response.ok) return null;
    const { result } = (await response.json()) as { result?: RpcTransactionReceipt | null };
    // Only a mined receipt for this hash counts (Blockscout can index pending transactions).
    const mined = result?.blockHash && result.blockNumber && (result.status === "0x1" || result.status === "0x0");
    if (!result || !mined || result.transactionHash?.toLowerCase() !== hash.toLowerCase()) return null;
    return formatTransactionReceipt(result);
  } catch {
    return null;
  }
}

async function viemReceipt(
  config: Config,
  hash: Hash,
  chainId: number,
  deadline: number,
  replaced: { value?: { reason: string; transaction: { hash: Hash } } },
): Promise<TransactionReceipt> {
  for (;;) {
    try {
      return await waitForTransactionReceipt(config, {
        hash,
        chainId,
        pollingInterval: RETRY_PAUSE_MS,
        timeout: Math.max(deadline - Date.now(), 1),
        onReplaced: (replacement) => {
          replaced.value = replacement;
        },
      });
    } catch (error) {
      const failure = receiptFailure(error, hash);
      const viemTimedOut = chainNames(causeChain(error)).includes("WaitForTransactionReceiptTimeoutError");
      if (!(failure instanceof ConfirmationTimeoutError) || viemTimedOut || Date.now() + RETRY_PAUSE_MS >= deadline) {
        throw failure;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
  }
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
