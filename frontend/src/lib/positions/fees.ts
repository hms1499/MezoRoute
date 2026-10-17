import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";

export type Fees = { musd: bigint; btc: bigint };

/** The pool's fee accounting for one account, as read in the snapshot (token0/token1 order). */
export type FeeState = {
  lpBalance: bigint;
  index0: bigint;
  index1: bigint;
  supplyIndex0: bigint;
  supplyIndex1: bigint;
  claimable0: bigint;
  claimable1: bigint;
};

/**
 * What `claimFees()` would pay now, mirroring Pool._updateFor: the stored claimable plus
 * `balance × (index − supplyIndex) / 1e18` per token. LP transfers run `_updateFor`, so fees stay
 * claimable after an exit.
 */
export function claimableFees(network: NetworkConfig, state: FeeState): Fees {
  const accrued = (index: bigint, supplyIndex: bigint) =>
    state.lpBalance > 0n && index > supplyIndex ? (state.lpBalance * (index - supplyIndex)) / WAD : 0n;
  const amount0 = state.claimable0 + accrued(state.index0, state.supplyIndex0);
  const amount1 = state.claimable1 + accrued(state.index1, state.supplyIndex1);
  return musdIsToken0(network) ? { musd: amount0, btc: amount1 } : { musd: amount1, btc: amount0 };
}
