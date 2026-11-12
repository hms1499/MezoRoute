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
import { btcGasReserve, spendableCap } from "./asset";
import { entryBlock, type EntryBlock, type EntryGateInput } from "./gate";
import type { EntryIntent } from "./intent";
import { DEADLINE_SECONDS } from "./params";
import type { LpRouteData } from "./snapshot";
import { entrySteps, type StepKind } from "./steps";

/** Borrow & Deploy's part of the preview; null in deposit mode. */
export type BorrowPreview = { trove: Trove | null; limit: bigint; recoveryMode: boolean; effect: BorrowEffect | null };

/**
 * A BTC entry's wallet side. `fillReserve` is what Max and "Use my balance" keep back: it always includes the
 * approval a wallet without permits needs. `gasReserve` is what the gate keeps back for the steps still to come
 * (an approval already paid is not counted again). Both are null while the gas price is unknown (Ruling P18:
 * the entry is blocked, nothing is reserved at 0). `maxSpendable` is the balance less `fillReserve`, capped.
 */
export type BtcPreview = {
  walletBtc: bigint;
  fillReserve: bigint | null;
  gasReserve: bigint | null;
  maxSpendable: bigint;
  cap: bigint;
};

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
  /** What `block` was decided from; the wallet-less planner asks the gate again about the amount alone (U17). */
  gateInput: EntryGateInput;
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
  // Max keeps back the approval whenever the wallet cannot sign a permit, whatever the allowance now is, so the
  // amount it fills in still covers the whole plan; the gate counts only the steps still to come (`gasUnits`).
  const btc: BtcPreview | null = fromBtc
    ? (() => {
        const price = data.gasPrice;
        const fillUnits = entryGasUnits({ approve: !walletCapabilities(walletKind).permit, smartAccount, stake: stake.on, asset: "btc" });
        const fillReserve = price === undefined ? null : btcGasReserve(fillUnits, price);
        return {
          walletBtc: data.gasBalance,
          fillReserve,
          gasReserve: price === undefined ? null : btcGasReserve(gasUnits, price),
          maxSpendable: fillReserve === null ? 0n : spendableCap(data.gasBalance, fillReserve, network.entryCapBtc),
          cap: network.entryCapBtc,
        };
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
  const gateInput: EntryGateInput = {
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
  };
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
    block: entryBlock(gateInput),
    gateInput,
  };
}
