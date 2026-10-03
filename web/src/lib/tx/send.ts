import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { getAccount, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { asRelayFailure, RelayError, SmartAccountCallFailedError } from "./errors";
import { hasSafeExecutionFailure } from "./safe";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Mezo's relayer reports failure as hash "0x" instead of throwing (OrangeKit MezoTransactionSender). */
export function assertTxHash(value: unknown): Hash {
  if (typeof value !== "string" || !TX_HASH.test(value)) {
    throw new RelayError(`The wallet returned no transaction hash (${String(value)}); nothing was submitted.`);
  }
  return value as Hash;
}

/**
 * Sends one call from the connected wallet and waits for a successful receipt. The same path
 * serves EOAs and OrangeKit smart accounts: wagmi resolves `sendTransaction` to OrangeKit's
 * Safe-relaying override for Bitcoin wallets.
 */
export async function sendCall(config: Config, call: { to: Address; data: Hex }): Promise<TransactionReceipt> {
  const connectorType = getAccount(config).connector?.type;
  let sent: unknown;
  try {
    sent = await sendTransaction(config, { to: call.to, data: call.data });
  } catch (error) {
    throw asRelayFailure(error, connectorType);
  }
  const hash = assertTxHash(sent);
  // The public testnet RPC intermittently returns null receipts; viem keeps polling until the timeout.
  const receipt = await waitForTransactionReceipt(config, { hash, pollingInterval: 2_000, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  if (hasSafeExecutionFailure(receipt.logs)) throw new SmartAccountCallFailedError(hash);
  return receipt;
}
