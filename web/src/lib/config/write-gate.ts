import type { NetworkConfig } from "./networks";

export type WriteBlocker = "no-executor" | "wrong-network";

/** Why write actions are disabled, if they are (spec FR-01). Every write button goes through this gate. */
export function writeBlocker(network: NetworkConfig, walletChainId: number | undefined): WriteBlocker | null {
  if (network.executor === null) return "no-executor";
  if (walletChainId !== network.chainId) return "wrong-network";
  return null;
}

export function writeBlockerMessage(blocker: WriteBlocker, network: NetworkConfig): string {
  return blocker === "no-executor"
    ? "Mainnet actions open after launch. Reading only."
    : `MezoRoute executes on ${network.name}.`;
}
