import { decodeEventLog, isAddressEqual, type Hex } from "viem";
import { poolAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { needsGas, noExecutor, NOTHING_TO_CLAIM, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import { formatToken } from "@/lib/format";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";
import { BlockedError } from "@/lib/tx/errors";
import type { Fees } from "./fees";

export type ClaimBlock = { reason: "no-executor" | "wrong-network" | "nothing-to-claim" | "needs-gas"; outcome: Outcome };

/** Why Claim is disabled (Flow G2). Mainnet stays read-only until M1, like every other write. */
export function claimBlock(input: {
  network: NetworkConfig;
  walletChainId: number | undefined;
  fees: Fees;
  lacksGas: boolean;
}): ClaimBlock | null {
  const blocker = writeBlocker(input.network, input.walletChainId);
  if (blocker === "no-executor") return { reason: "no-executor", outcome: noExecutor(input.network) };
  if (blocker === "wrong-network") return { reason: "wrong-network", outcome: wrongNetwork(input.network) };
  if (input.fees.musd === 0n && input.fees.btc === 0n) return { reason: "nothing-to-claim", outcome: NOTHING_TO_CLAIM };
  if (input.lacksGas) return { reason: "needs-gas", outcome: needsGas(input.network) };
  return null;
}

/** The pool's `Claim` event from a receipt, as MUSD and BTC (token order mapped by address). */
export function findClaimEvent(logs: readonly LogLike[], network: NetworkConfig): Fees | null {
  for (const log of logs) {
    if (!isAddressEqual(log.address, network.addresses.pool) || log.topics.length === 0) continue;
    try {
      const { args } = decodeEventLog({ abi: poolAbi, eventName: "Claim", topics: log.topics as [Hex, ...Hex[]], data: log.data });
      return musdIsToken0(network) ? { musd: args.amount0, btc: args.amount1 } : { musd: args.amount1, btc: args.amount0 };
    } catch {
      // Another pool event (Transfer, Sync, …); keep looking.
    }
  }
  return null;
}

export function claimRows(fees: Fees): { label: string; value: string }[] {
  return [
    { label: "MUSD claimed", value: `${formatToken(fees.musd)} MUSD` },
    { label: "BTC claimed", value: `${formatToken(fees.btc)} BTC` },
  ];
}

/** After simulating `claimFees()`: a (0, 0) result means the fees were claimed elsewhere since the snapshot. */
export function assertClaimable(claimed: readonly [bigint, bigint]): void {
  if (claimed[0] === 0n && claimed[1] === 0n) throw new BlockedError(NOTHING_TO_CLAIM);
}
