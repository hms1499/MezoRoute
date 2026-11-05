import { decodeEventLog, encodeFunctionData, isAddressEqual, type Address, type Hex } from "viem";
import { gaugeAbi } from "@/lib/abi/gauge";
import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import {
  GAUGE_READ_FAILED,
  needsGas,
  noExecutor,
  NO_PENDING_MEZO,
  NO_STAKED_LP,
  NO_WALLET_LP,
  STAKING_CLOSED_NOW,
  wrongNetwork,
} from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import { formatToken } from "@/lib/format";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";
import { BlockedError } from "@/lib/tx/errors";
import type { GaugeState } from "./state";

export type GaugeAction = "claim" | "stake" | "unstake";
export type GaugeActionBlock = {
  reason: "no-executor" | "wrong-network" | "nothing-to-do" | "needs-gas";
  outcome: Outcome;
};

/** The fresh gauge state a send acts on. A failed read asks for a retry; only a network without a gauge is an error. */
export function gaugeForAction(snapshot: { gauge: GaugeState | null; gaugeReadFailed: boolean }): GaugeState {
  if (snapshot.gaugeReadFailed) throw new BlockedError(GAUGE_READ_FAILED);
  if (!snapshot.gauge) throw new Error("This network has no gauge");
  return snapshot.gauge;
}

/**
 * Why a gauge button is disabled. Mainnet stays read-only like every other write, hence `writeBlocker`.
 * Staking needs a live gauge; claiming and unstaking work even after the voter stops counting it.
 */
export function gaugeActionBlock(input: {
  network: NetworkConfig;
  walletChainId: number | undefined;
  action: GaugeAction;
  state: GaugeState;
  walletLp: bigint;
  lacksGas: boolean;
}): GaugeActionBlock | null {
  const { action, state } = input;
  const blocker = writeBlocker(input.network, input.walletChainId);
  if (blocker === "no-executor") return { reason: "no-executor", outcome: noExecutor(input.network) };
  if (blocker === "wrong-network") return { reason: "wrong-network", outcome: wrongNetwork(input.network) };
  if (action === "claim" && state.earned === 0n) return { reason: "nothing-to-do", outcome: NO_PENDING_MEZO };
  if (action === "stake" && input.walletLp === 0n) return { reason: "nothing-to-do", outcome: NO_WALLET_LP };
  if (action === "stake" && !state.alive) return { reason: "nothing-to-do", outcome: STAKING_CLOSED_NOW };
  if (action === "unstake" && state.staked === 0n) return { reason: "nothing-to-do", outcome: NO_STAKED_LP };
  if (input.lacksGas) return { reason: "needs-gas", outcome: needsGas(input.network) };
  return null;
}

/** Calldata for a direct gauge call: `getReward(account)`, `deposit(amount)`, or `withdraw(amount)`. */
export function encodeGaugeCall(
  call: { action: "claim"; account: Address } | { action: "stake" | "unstake"; amount: bigint },
): Hex {
  if (call.action === "claim") return encodeFunctionData({ abi: gaugeAbi, functionName: "getReward", args: [call.account] });
  return encodeFunctionData({
    abi: gaugeAbi,
    functionName: call.action === "stake" ? "deposit" : "withdraw",
    args: [call.amount],
  });
}

function findGaugeEvent<Name extends "ClaimRewards" | "Deposit" | "Withdraw">(logs: readonly LogLike[], gauge: Address, name: Name) {
  for (const log of logs) {
    if (!isAddressEqual(log.address, gauge) || log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({ abi: gaugeAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
      // viem decodes whichever ABI event the topic matches; `eventName` only narrows the type.
      if (decoded.eventName === name) return decoded.args as { amount: bigint };
    } catch {
      // Another gauge event, or a log that is not the gauge's; keep looking.
    }
  }
  return null;
}

/** The gauge's `ClaimRewards` amount (MEZO, 1e18) from a receipt's logs. */
export function findRewardEvent(logs: readonly LogLike[], gauge: Address): { amount: bigint } | null {
  const args = findGaugeEvent(logs, gauge, "ClaimRewards");
  return args ? { amount: args.amount } : null;
}

export type GaugeReceipt = { action: GaugeAction; amount: bigint };

/** What a direct gauge transaction did, from its logs: MEZO claimed, LP staked (`Deposit`), or LP unstaked (`Withdraw`). */
export function findGaugeReceipt(logs: readonly LogLike[], gauge: Address): GaugeReceipt | null {
  const reward = findRewardEvent(logs, gauge);
  if (reward) return { action: "claim", amount: reward.amount };
  const deposit = findGaugeEvent(logs, gauge, "Deposit");
  if (deposit) return { action: "stake", amount: deposit.amount };
  const withdraw = findGaugeEvent(logs, gauge, "Withdraw");
  return withdraw ? { action: "unstake", amount: withdraw.amount } : null;
}

/** Receipt rows for a gauge action (event values only, FR-11). */
export function gaugeReceiptRows(receipt: GaugeReceipt): { label: string; value: string }[] {
  if (receipt.action === "claim") return [{ label: "MEZO claimed", value: `${formatToken(receipt.amount, 18, 4)} MEZO` }];
  return [{ label: receipt.action === "stake" ? "LP staked" : "LP unstaked", value: `${formatToken(receipt.amount)} LP` }];
}
