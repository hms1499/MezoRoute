import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { needsGas, noExecutor, NOTHING_TO_CLAIM, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
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
