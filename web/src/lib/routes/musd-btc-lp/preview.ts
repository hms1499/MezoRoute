import type { NetworkConfig } from "@/lib/config/networks";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { lacksGas } from "@/lib/dashboard/readiness";
import { entryMinimums, quoteEntry, type EntryMinimums, type EntryQuote } from "@/lib/quote/entry";
import { entryGasUnits } from "@/lib/quote/gas";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { afterEntry } from "./after-entry";
import { entryBlock, type EntryBlock } from "./gate";
import type { EntryIntent } from "./intent";
import { DEADLINE_SECONDS } from "./params";
import type { LpRouteData } from "./snapshot";
import { entrySteps, type StepKind } from "./steps";

export type EntryPreview = {
  quote: EntryQuote | null;
  minimums: EntryMinimums | null;
  steps: StepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  after: DashboardSnapshot | null;
  block: EntryBlock | null;
};

/** Everything both LP pages show and gate on, computed from one snapshot. */
export function entryPreview(input: {
  network: NetworkConfig;
  data: LpRouteData;
  intent: EntryIntent;
  walletKind: WalletKind;
  walletChainId: number | undefined;
  now: number;
}): EntryPreview {
  const { network, data, intent, walletKind } = input;
  const { snapshot } = data;
  const quote = intent.musdIn === null ? null : quoteEntry(snapshot.pool, intent.musdIn, snapshot.executorFeeBps);
  const steps = entrySteps(walletKind, snapshot.allowance, intent.musdIn ?? 0n);
  const gasUnits = entryGasUnits({ approve: steps.includes("approve"), smartAccount: walletKind === "smart-account" });
  return {
    quote,
    minimums: quote && entryMinimums(quote, intent.slippageBps),
    steps,
    gasUnits,
    gasCost: data.gasPrice === undefined ? null : gasUnits * data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    after: quote && afterEntry(snapshot.dashboard, quote),
    block: entryBlock({
      network,
      walletChainId: input.walletChainId,
      chainFeeBps: snapshot.executorFeeBps,
      musdIn: intent.musdIn,
      walletMusd: snapshot.dashboard.musd,
      maxMusdIn: snapshot.maxMusdIn,
      quote,
      lacksGas: lacksGas(data.gasBalance, data.gasPrice),
      quoteAgeMs: input.now - data.fetchedAt,
    }),
  };
}
