import type { NetworkConfig } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exitLiquidity, type ExitPercent } from "@/lib/positions/exit-intent";
import { spGasUnits } from "@/lib/quote/gas";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { afterSpDeposit } from "./after-deposit";
import { spClaimBlock, spDepositBlock, spWithdrawBlock, type SpBlock } from "./gate";
import type { SpData } from "./snapshot";
import { spDepositSteps, type SpStepKind } from "./steps";

type Common = { network: NetworkConfig; data: SpData; walletChainId: number | undefined };

export type SpDepositPreview = {
  musdIn: bigint | null;
  steps: SpStepKind[];
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  depositNow: bigint; // compounded
  gainPaid: bigint; // the pending BTC gain provideToSP pays to the wallet
  depositAfter: bigint | null;
  after: DashboardSnapshot | null; // for the exposure before/after
  block: SpBlock | null;
};

/** Everything both deposit pages show and gate on, from one snapshot (Flow E). */
export function spDepositPreview(input: Common & { musdIn: bigint | null; walletKind: WalletKind }): SpDepositPreview {
  const { snapshot } = input.data;
  const { dashboard } = snapshot;
  const steps = spDepositSteps(snapshot.allowance, input.musdIn ?? 0n);
  const units = spGasUnits({ approve: steps.includes("approve"), smartAccount: input.walletKind === "smart-account", action: "deposit" });
  const depositAfter = input.musdIn === null ? null : dashboard.sp.deposit + input.musdIn;
  return {
    musdIn: input.musdIn,
    steps,
    gasCost: input.data.gasPrice === undefined ? null : units * input.data.gasPrice,
    depositNow: dashboard.sp.deposit,
    gainPaid: dashboard.sp.btcGain,
    depositAfter,
    after: input.musdIn === null ? null : afterSpDeposit(dashboard, input.musdIn),
    block: spDepositBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      musdIn: input.musdIn,
      walletMusd: dashboard.musd,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
    }),
  };
}

export type SpWithdrawPreview = { amount: bigint; depositAfter: bigint; gainPaid: bigint; gasCost: bigint | null; block: SpBlock | null };

/** Flow H: a share of the compounded deposit; Max is the exact deposit, so no dust stays behind. */
export function spWithdrawPreview(input: Common & { percent: ExitPercent; walletKind: WalletKind }): SpWithdrawPreview {
  const { snapshot } = input.data;
  const compounded = snapshot.dashboard.sp.deposit;
  const amount = exitLiquidity(compounded, input.percent);
  const units = spGasUnits({ approve: false, smartAccount: input.walletKind === "smart-account", action: "withdraw" });
  return {
    amount,
    depositAfter: compounded - amount,
    gainPaid: snapshot.dashboard.sp.btcGain,
    gasCost: input.data.gasPrice === undefined ? null : units * input.data.gasPrice,
    block: spWithdrawBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      initialDeposit: snapshot.initialDeposit,
      amount,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
    }),
  };
}

export function spClaimPreview(input: Common): SpBlock | null {
  const { snapshot } = input.data;
  return spClaimBlock({
    network: input.network,
    walletChainId: input.walletChainId,
    initialDeposit: snapshot.initialDeposit,
    gain: snapshot.dashboard.sp.btcGain,
    lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
  });
}
