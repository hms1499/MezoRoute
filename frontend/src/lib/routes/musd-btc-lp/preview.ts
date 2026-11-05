import { effectiveStake, stakeAvailability, type StakeAvailability } from "@/lib/gauge/availability";
import type { NetworkConfig } from "@/lib/config/networks";
import type { DashboardSnapshot, Trove } from "@/lib/dashboard/snapshot";
import { lacksGas } from "@/lib/dashboard/readiness";
import {
  btcEntryMinimums,
  entryMinimums,
  quoteEntry,
  quoteEntryFromBtc,
  type BtcEntryMinimums,
  type BtcEntryQuote,
  type EntryMinimums,
  type EntryQuote,
} from "@/lib/quote/entry";
import { entryGasUnits } from "@/lib/quote/gas";
import { borrowEffect, borrowLimit, isRecoveryMode, type BorrowEffect } from "@/lib/trove/borrow";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import { afterBorrowEntry, afterBtcEntry, afterEntry } from "./after-entry";
import { btcGasReserve, maxBtcSpendable } from "./asset";
import { entryBlock, type EntryBlock } from "./gate";
import type { EntryIntent } from "./intent";
import { DEADLINE_SECONDS } from "./params";
import type { LpRouteData } from "./snapshot";
import { entrySteps, type StepKind } from "./steps";

/** Borrow & Deploy's part of the preview; null in deposit mode. */
export type BorrowPreview = { trove: Trove | null; limit: bigint; recoveryMode: boolean; effect: BorrowEffect | null };

/** A BTC entry's wallet side: the balance, the gas reserve kept back, and what "Use my balance" may enter (reserve and cap applied). */
export type BtcPreview = { walletBtc: bigint; gasReserve: bigint; maxSpendable: bigint; cap: bigint };

export type EntryPreview = {
  /** The MUSD entry's quote; null for a BTC entry. */
  quote: EntryQuote | null;
  minimums: EntryMinimums | null;
  /** The BTC entry's quote and minimums; null for a MUSD entry. */
  btcQuote: BtcEntryQuote | null;
  btcMinimums: BtcEntryMinimums | null;
  btc: BtcPreview | null;
  steps: StepKind[];
  gasUnits: bigint;
  gasCost: bigint | null; // BTC; null when the gas price failed to load
  deadline: bigint; // unix seconds: snapshot block time + 10 minutes
  after: DashboardSnapshot | null;
  borrow: BorrowPreview | null;
  /** Whether the gauge can take the LP, and whether this entry will stake it (the URL wish, applied). */
  stake: { availability: StakeAvailability; on: boolean };
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
  const fromBtc = intent.asset === "btc";
  const quote = intent.musdIn === null ? null : quoteEntry(snapshot.pool, intent.musdIn, snapshot.executorFeeBps);
  const btcQuote = intent.btcIn === null ? null : quoteEntryFromBtc(snapshot.pool, intent.btcIn, snapshot.executorFeeBps);
  const availability = stakeAvailability(snapshot.gauge, snapshot.blockTimestamp);
  const stake = { availability, on: effectiveStake(intent.stake, availability) };
  const steps = entrySteps(
    walletKind,
    fromBtc ? snapshot.btcAllowance : snapshot.allowance,
    (fromBtc ? intent.btcIn : intent.musdIn) ?? 0n,
    intent.mode,
  );
  const smartAccount = walletKind === "smart-account";
  const gasUnits = entryGasUnits({
    approve: steps.includes("approve"),
    smartAccount,
    borrow: borrowing,
    stake: stake.on,
    asset: intent.asset,
  });
  // The reserve is sized for the approval whenever the wallet cannot sign a permit, whatever the allowance now
  // is, so the amount "Use my balance" fills in never needs more gas than the reserve once the plan is built.
  const btc: BtcPreview | null = fromBtc
    ? (() => {
        const gasReserve = btcGasReserve(
          entryGasUnits({ approve: !walletCapabilities(walletKind).permit, smartAccount, stake: stake.on, asset: "btc" }),
          data.gasPrice,
        );
        const cap = network.entryCapBtc;
        const spendable = maxBtcSpendable(data.gasBalance, gasReserve);
        return { walletBtc: data.gasBalance, gasReserve, maxSpendable: spendable < cap ? spendable : cap, cap };
      })()
    : null;
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
  const after = btcQuote
    ? afterBtcEntry(dashboard, btcQuote)
    : !quote
      ? null
      : borrow
        ? borrow.effect && afterBorrowEntry(dashboard, quote, borrow.effect)
        : afterEntry(dashboard, quote);
  return {
    quote: fromBtc ? null : quote,
    minimums: !fromBtc && quote ? entryMinimums(quote, intent.slippageBps) : null,
    btcQuote: fromBtc ? btcQuote : null,
    btcMinimums: fromBtc && btcQuote ? btcEntryMinimums(btcQuote, intent.slippageBps) : null,
    btc,
    steps,
    gasUnits,
    gasCost: data.gasPrice === undefined ? null : gasUnits * data.gasPrice,
    deadline: snapshot.blockTimestamp + DEADLINE_SECONDS,
    after,
    borrow,
    stake,
    block: entryBlock({
      network,
      walletChainId: input.walletChainId,
      chainFeeBps: snapshot.executorFeeBps,
      musdIn: intent.musdIn,
      walletMusd: dashboard.musd,
      maxMusdIn: snapshot.maxMusdIn,
      quote: fromBtc ? btcQuote : quote,
      btc: btc && { btcIn: intent.btcIn, walletBtc: btc.walletBtc, maxBtcIn: btc.cap, gasReserve: btc.gasReserve },
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
