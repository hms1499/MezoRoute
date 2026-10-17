import type { NetworkConfig } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import { exitMinimums, quoteExit, type ExitMinimums, type ExitQuote } from "@/lib/quote/exit";
import { exitGasUnits } from "@/lib/quote/gas";
import { DEADLINE_SECONDS } from "@/lib/routes/musd-btc-lp/params";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { exitBlock, type ExitBlock } from "./exit-gate";
import { exitLiquidity, type ExitIntent } from "./exit-intent";
import { exitSteps, type ExitStepKind } from "./exit-steps";
import type { PositionsData } from "./snapshot";

export type ExitPreview = {
  liquidityIn: bigint;
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
  const liquidityIn = input.liquidityIn ?? exitLiquidity(snapshot.lpBalance, input.intent.percent);
  const quote = quoteExit(snapshot.pool, liquidityIn);
  const steps = exitSteps(input.walletKind, snapshot.allowance, liquidityIn);
  const gasUnits = exitGasUnits({ approve: steps.includes("approve"), smartAccount: input.walletKind === "smart-account" });
  return {
    liquidityIn,
    quote,
    minimums: quote && exitMinimums(quote, input.intent.slippageBps),
    steps,
    gasUnits,
    gasCost: input.data.gasPrice === undefined ? null : gasUnits * input.data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    block: exitBlock({
      network: input.network,
      walletChainId: input.walletChainId,
      lpBalance: snapshot.lpBalance,
      liquidityIn,
      quote,
      lacksGas: lacksGas(input.data.gasBalance, input.data.gasPrice),
      quoteAgeMs: input.now - input.data.fetchedAt,
    }),
  };
}
