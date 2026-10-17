import type { NetworkConfig } from "@/lib/config/networks";
import type { DashboardSnapshot, Trove } from "@/lib/dashboard/snapshot";
import { lacksGas } from "@/lib/dashboard/readiness";
import { entryMinimums, quoteEntry, type EntryMinimums, type EntryQuote } from "@/lib/quote/entry";
import { entryGasUnits } from "@/lib/quote/gas";
import { borrowEffect, borrowLimit, isRecoveryMode, type BorrowEffect } from "@/lib/trove/borrow";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import { afterBorrowEntry, afterEntry } from "./after-entry";
import { entryBlock, type EntryBlock } from "./gate";
import type { EntryIntent } from "./intent";
import { DEADLINE_SECONDS } from "./params";
import type { LpRouteData } from "./snapshot";
import { entrySteps, type StepKind } from "./steps";

/** Borrow & Deploy's part of the preview; null in deposit mode. */
export type BorrowPreview = { trove: Trove | null; limit: bigint; recoveryMode: boolean; effect: BorrowEffect | null };

export type EntryPreview = {
  quote: EntryQuote | null;
  minimums: EntryMinimums | null;
  steps: StepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  after: DashboardSnapshot | null;
  borrow: BorrowPreview | null;
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
  const { dashboard } = snapshot;
  const borrowing = intent.mode === "borrow";
  const quote = intent.musdIn === null ? null : quoteEntry(snapshot.pool, intent.musdIn, snapshot.executorFeeBps);
  const steps = entrySteps(walletKind, snapshot.allowance, intent.musdIn ?? 0n, intent.mode);
  const gasUnits = entryGasUnits({
    approve: steps.includes("approve"),
    smartAccount: walletKind === "smart-account",
    borrow: borrowing,
  });
  const borrow: BorrowPreview | null = borrowing
    ? {
        trove: dashboard.trove,
        limit: borrowLimit(dashboard.trove, dashboard.price, dashboard.protocol, snapshot.maxMusdIn),
        recoveryMode: isRecoveryMode(snapshot.system, dashboard.price),
        effect:
          dashboard.trove && intent.musdIn !== null
            ? borrowEffect(dashboard.trove, dashboard.price, dashboard.protocol, intent.musdIn)
            : null,
      }
    : null;
  const after = !quote
    ? null
    : borrow
      ? borrow.effect && afterBorrowEntry(dashboard, quote, borrow.effect)
      : afterEntry(dashboard, quote);
  return {
    quote,
    minimums: quote && entryMinimums(quote, intent.slippageBps),
    steps,
    gasUnits,
    gasCost: data.gasPrice === undefined ? null : gasUnits * data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    after,
    borrow,
    block: entryBlock({
      network,
      walletChainId: input.walletChainId,
      chainFeeBps: snapshot.executorFeeBps,
      musdIn: intent.musdIn,
      walletMusd: dashboard.musd,
      maxMusdIn: snapshot.maxMusdIn,
      quote,
      lacksGas: lacksGas(data.gasBalance, data.gasPrice),
      quoteAgeMs: input.now - data.fetchedAt,
      borrow: borrow && {
        canSign: walletCapabilities(walletKind).borrowAndDeploy,
        hasTrove: borrow.trove !== null,
        recoveryMode: borrow.recoveryMode,
        limit: borrow.limit,
        newCr: borrow.effect?.newCr ?? null,
      },
    }),
  };
}
