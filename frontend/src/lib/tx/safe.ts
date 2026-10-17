import { toEventSelector, type Hex } from "viem";

/**
 * Safe emits ExecutionFailure (instead of reverting) when the inner call fails and safeTxGas or
 * gasPrice is non-zero, which OrangeKit always sets. The relayed transaction then has status success.
 */
export const SAFE_EXECUTION_FAILURE_TOPIC = toEventSelector("ExecutionFailure(bytes32,uint256)");

export function hasSafeExecutionFailure(logs: readonly { topics: readonly Hex[] }[]): boolean {
  return logs.some((log) => log.topics[0]?.toLowerCase() === SAFE_EXECUTION_FAILURE_TOPIC);
}
