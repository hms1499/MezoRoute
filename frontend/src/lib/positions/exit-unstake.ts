import { GAUGE_READ_FAILED, LP_CHANGED } from "@/lib/errors/outcomes";
import { BlockedError } from "@/lib/tx/errors";
import { unstakeFor } from "./exit-intent";
import type { PositionsSnapshot } from "./snapshot";

/**
 * The LP this attempt must take out of the gauge, from the wallet as it is now; 0n means the step is already done. Working
 * from the wallet, not from a pinned amount, means retrying a withdraw that was mined but not confirmed cannot unstake twice.
 */
export function unstakeNeeded(snapshot: PositionsSnapshot, liquidityIn: bigint): bigint {
  const amount = unstakeFor(snapshot.lpBalance, liquidityIn);
  if (amount === 0n) return 0n;
  if (snapshot.gaugeReadFailed) throw new BlockedError(GAUGE_READ_FAILED);
  // The gauge no longer holds it (unstaked elsewhere): start over to plan from what the wallet holds now.
  if ((snapshot.gauge?.staked ?? 0n) < amount) throw new BlockedError(LP_CHANGED);
  return amount;
}
