import type { NetworkConfig } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import { exitMinimums, quoteExit, type ExitMinimums, type ExitQuote } from "@/lib/quote/exit";
import { exitGasUnits } from "@/lib/quote/gas";
import { DEADLINE_SECONDS } from "@/lib/routes/musd-btc-lp/params";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { exitBlock, type ExitBlock } from "./exit-gate";
import { exitPlan, unstakeFor, type ExitIntent } from "./exit-intent";
import { exitSteps, type ExitStepKind } from "./exit-steps";
import type { PositionsData } from "./snapshot";

export type ExitPreview = {
  liquidityIn: bigint;
  unstake: bigint; // LP the gauge must release first; 0 when the wallet holds it
  quote: ExitQuote | null;
  minimums: ExitMinimums | null;
  steps: ExitStepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  block: ExitBlock | null;
};

/**
 * Everything the exit page shows and gates on, from one snapshot. `liquidityIn` is the amount the
 * flow pinned when its first step started; before that it follows the percent.
 */
export function exitPreview(input: {
  network: NetworkConfig;
  data: PositionsData;
  intent: ExitIntent;
  liquidityIn?: bigint;
  walletKind: WalletKind;
  walletChainId: number | undefined;
  now: number;
}): ExitPreview {
  const { snapshot } = input.data;
  const walletLp = snapshot.lpBalance;
  const stakedLp = snapshot.gauge?.staked ?? 0n;
  const planned = exitPlan(walletLp, stakedLp, input.intent.percent);
  const liquidityIn = input.liquidityIn ?? planned.liquidityIn;
  // A pinned amount is re-planned against the wallet as it is now: after the unstake confirms (or a reload) it needs none.
  const unstake = input.liquidityIn === undefined ? planned.unstake : unstakeFor(walletLp, liquidityIn);
  const quote = quoteExit(snapshot.pool, liquidityIn);
  const steps = exitSteps(input.walletKind, snapshot.allowance, liquidityIn, unstake);
  const gasUnits = exitGasUnits({
    approve: steps.includes("approve"),
    smartAccount: input.walletKind === "smart-account",
    unstake: unstake > 0n,
  });
  return {
    liquidityIn,
    unstake,
    quote,
    minimums: quote && exitMinimums(quote, input.intent.slippageBps),
    steps,
    gasUnits,
    gasCost: input.data.gasPrice === undefined ? null : gasUnits * input.data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    block: exitBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      lpBalance: walletLp + stakedLp,
      liquidityIn,
      quote,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
      quoteAgeMs: input.now - input.data.fetchedAt,
    }),
  };
}
