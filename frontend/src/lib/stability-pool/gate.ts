import type { NetworkConfig } from "@/lib/config/networks";
import { writeBlocker } from "@/lib/config/write-gate";
import { AMOUNT_TOO_SMALL, INSUFFICIENT_BALANCE, needsGas, NO_SP_DEPOSIT, NO_SP_GAIN, noExecutor, wrongNetwork } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";

export type SpBlockReason =
  | "no-executor"
  | "wrong-network"
  | "zero"
  | "insufficient-balance"
  | "no-deposit"
  | "too-small"
  | "no-gain"
  | "needs-gas";
/** `outcome` is null when the button simply stays disabled (no amount yet). */
export type SpBlock = { reason: SpBlockReason; outcome: Outcome | null };

type WriteInput = { network: NetworkConfig; walletChainId: number | undefined };

const block = (reason: SpBlockReason, outcome: Outcome | null): SpBlock => ({ reason, outcome });

/** Mainnet stays read-only until M1, like every other write. */
function writeBlock({ network, walletChainId }: WriteInput): SpBlock | null {
  const blocker = writeBlocker(network, walletChainId);
  if (blocker === "no-executor") return block("no-executor", noExecutor(network));
  if (blocker === "wrong-network") return block("wrong-network", wrongNetwork(network));
  return null;
}

/** Flow E; the first matching reason wins. No cap: the per-transaction cap belongs to the executor. */
export function spDepositBlock(input: WriteInput & { musdIn: bigint | null; walletMusd: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.musdIn === null) return block("zero", null);
  if (input.musdIn > input.walletMusd) return block("insufficient-balance", INSUFFICIENT_BALANCE);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}

/** Flow H. The blocked-withdrawal state comes from simulating the call, not from this gate. */
export function spWithdrawBlock(input: WriteInput & { initialDeposit: bigint; amount: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.initialDeposit === 0n) return block("no-deposit", NO_SP_DEPOSIT);
  if (input.amount === 0n) return block("too-small", AMOUNT_TOO_SMALL);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}

/** Claim BTC gain is `withdrawFromSP(0)`: it needs a deposit and a gain, and is never paused. */
export function spClaimBlock(input: WriteInput & { initialDeposit: bigint; gain: bigint; lacksGas: boolean }): SpBlock | null {
  const write = writeBlock(input);
  if (write) return write;
  if (input.initialDeposit === 0n) return block("no-deposit", NO_SP_DEPOSIT);
  if (input.gain === 0n) return block("no-gain", NO_SP_GAIN);
  if (input.lacksGas) return block("needs-gas", needsGas(input.network));
  return null;
}
