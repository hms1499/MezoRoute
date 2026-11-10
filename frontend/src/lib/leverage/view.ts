import type { OverviewRow } from "@/components/flow/Overview";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { troveGasBudget } from "@/lib/quote/gas";
import { EVM_ONLY, MAINNET_NOT_RUN, RECOVERY_MODE_BLOCK } from "./copy";
import type { GateQuote, TroveBlockReason } from "./gate";
import type { TroveAction } from "./intent";
import type { TroveSnapshot } from "./snapshot";
import type { CapacityCheck } from "./capacity";
import { QUOTE_CR_BUFFER_BPS } from "./steps";
import type { LeverageLimit } from "./quote-leverage";
import { cr, liquidationPriceOf, type TroveState } from "./trove-math";

const musd = (v: bigint) => `${formatToken(v, 18, 2)} MUSD`;
const btc = (v: bigint) => `${formatToken(v, 18, 6)} BTC`;
const arrow = (a: string, b: string) => `${a} → ${b}`;

/** The headline figure (spec L1): the swap against PriceFeed, positive = a cost. */
export function costText(costBps: bigint): string {
  if (costBps === 0n) return "At Mezo's oracle price";
  return costBps > 0n ? `${formatBps(costBps)} above Mezo's oracle price` : `${formatBps(-costBps)} better than Mezo's oracle price`;
}

function troveRows(before: TroveState | null, after: TroveState, snapshot: TroveSnapshot): OverviewRow[] {
  const { price, mcr } = snapshot.market;
  const ratio = (t: TroveState | null) => {
    const r = t ? cr(t, price) : null;
    return r === null ? "—" : formatPercent(r);
  };
  const liq = liquidationPriceOf(after, mcr);
  return [
    { label: "Collateral", value: arrow(before ? btc(before.coll) : "—", btc(after.coll)), tone: "btc" },
    { label: "Debt", value: arrow(before ? musd(before.debt) : "—", musd(after.debt)) },
    { label: "Collateral ratio", value: arrow(ratio(before), ratio(after)) },
    { label: "Liquidation price", value: liq === null ? "—" : `${formatToken(liq, 18, 0, "up")} MUSD / BTC` },
  ];
}

/** The Trove pages' aside (U14): the Trove as it stands; the ratio is the card's headline figure, so it is not repeated. */
export function troveNowRows(snapshot: TroveSnapshot): OverviewRow[] {
  const t = snapshot.trove;
  if (!t) return [{ label: "Trove", value: "None yet" }, { label: "Your BTC", value: btc(snapshot.walletBtc), tone: "btc" }];
  const liq = liquidationPriceOf(t, snapshot.market.mcr);
  return [
    { label: "Collateral", value: btc(t.coll), tone: "btc" },
    { label: "Debt", value: musd(t.debt) },
    { label: "Liquidation price", value: liq === null ? "—" : `${formatToken(liq, 18, 0, "up")} MUSD / BTC` },
  ];
}

/** Every amount page's and Confirm page's overview, cost first. */
export function troveOverviewRows(quote: GateQuote, snapshot: TroveSnapshot): OverviewRow[] {
  switch (quote.action) {
    case "unwind": {
      const q = quote.quote;
      return [
        { label: "Cost against the oracle", value: costText(q.costBps) },
        { label: "Debt repaid", value: musd(q.debtToRepay) },
        { label: "BTC sold", value: btc(q.btcToPool), sub: `at most ${btc(q.maxBtcToPool)}` },
        { label: "BTC to your wallet", value: btc(q.btcToWallet) },
        ...troveRows(q.before, q.after, snapshot),
      ];
    }
    case "close": {
      const q = quote.quote;
      return [
        { label: "Cost against the oracle", value: costText(q.costBps) },
        { label: "BTC to your wallet", value: btc(q.btcToWallet), tone: "btc" },
        { label: "Debt repaid", value: musd(q.musdNeeded), sub: "plus the 200 MUSD gas compensation the protocol settles" },
        { label: "BTC sold", value: btc(q.btcToPool), sub: `at most ${btc(q.maxBtcToPool)}` },
      ];
    }
    case "leverage": {
      const q = quote.quote;
      return [
        { label: "Cost against the oracle", value: costText(q.costBps) },
        { label: "BTC added", value: btc(q.btcToAdd), tone: "btc" },
        { label: "MUSD borrowed", value: musd(q.debtIncrease), sub: `Mezo borrowing fee ${musd(q.borrowingFee)} added to debt` },
        { label: "MezoRoute fee", value: musd(q.fee) },
        { label: "MUSD to your wallet", value: musd(q.musdSurplus) },
        ...troveRows(q.before, q.after, snapshot),
      ];
    }
    case "open": {
      const q = quote.quote;
      if (!q) return [];
      return [
        { label: "Cost against the oracle", value: costText(q.costBps) },
        { label: "BTC from your wallet", value: btc(q.btcFromUser) },
        { label: "BTC added from the pool", value: btc(q.btcToFlash), tone: "btc" },
        { label: "MUSD borrowed", value: musd(q.debtAmount) },
        { label: "MezoRoute fee", value: musd(q.fee) },
        { label: "MUSD to your wallet", value: musd(q.musdSurplus) },
        ...troveRows(null, q.after, snapshot),
      ];
    }
  }
}

const HALF = WAD / 2n;
const QUARTER = WAD / 4n;

/** Target-CR presets: Unwind steps up in 50% from today's CR; Leverage steps down in 25% from 200%, below today's CR. */
export function crPresets(action: "unwind" | "leverage", current: bigint): bigint[] {
  if (action === "unwind") {
    const base = (current / HALF) * HALF + HALF;
    return [base, base + HALF, base + 2n * HALF];
  }
  const out: bigint[] = [];
  for (let target = LEVERAGE_CR_FLOOR; target < current && out.length < 4; target += QUARTER) out.push(target);
  return out;
}

export type PageNoticeAction = "repay" | "close-instead" | "open-app";
export type PageNotice = { tone: "neutral" | "warning" | "danger"; text: string; actions: PageNoticeAction[] };

/** The one notice under a Trove page's header: the block that matters to a person, or the mainnet note. */
export function pageNotice(input: { action: TroveAction; snapshot: TroveSnapshot; network: NetworkConfig; block: TroveBlockReason | null }): PageNotice | null {
  switch (input.block) {
    case "recovery-mode":
      return { tone: "warning", text: RECOVERY_MODE_BLOCK, actions: input.snapshot.walletMusd > 0n ? ["repay", "open-app"] : ["open-app"] };
    case "smart-account":
      return { tone: "neutral", text: EVM_ONLY, actions: [] };
    case "below-min-debt":
      return { tone: "neutral", text: "Beyond this, the Trove would fall under the 1,800 MUSD minimum debt: close it instead.", actions: ["close-instead"] };
    default:
      break;
  }
  return input.network.id === "mainnet" && input.block === null ? { tone: "neutral", text: MAINNET_NOT_RUN, actions: [] } : null;
}

/** What stops the largest Leverage the page offers (`leverageMax`). */
export function leverageMaxNote(max: { btc: bigint; limitedBy: LeverageLimit }, floor: bigint): string {
  const pct = formatPercent(floor, 0);
  if (max.btc === 0n) return `Your Trove is already at or below ${pct}: there is no room to leverage.`;
  const amount = `Up to ${formatToken(max.btc, 18, 6)} BTC`;
  switch (max.limitedBy) {
    case "floor":
      return `${amount}: the most that keeps your Trove at ${pct} (the ${pct} floor).`;
    case "cap":
      return `${amount}: MezoRoute's per-transaction cap.`;
    case "capacity":
      return `${amount}: your Trove's borrowing capacity, even after a refinance.`;
    case "oracle":
      return `${amount}: beyond this the pool's price would sit more than 5% from Mezo's oracle.`;
  }
}

/** The Refinance step's reason, shown above the steps when the plan starts with it. */
export function refinanceNote(capacity: CapacityCheck): string | null {
  return capacity === "refinance"
    ? "Refinance first: your Trove's borrowing capacity was set when it opened and does not grow with added BTC. A refinance resets it from today's collateral (fee ≈ 0.02% of your debt) and moves the Trove to the current interest rate."
    : null;
}

/** Unwind's reach: below today's CR there is nothing to unwind; past `unwindMaxCr` the minimum debt binds and Close is the way. */
export function unwindReachNote(input: { current: bigint | null; maxCr: bigint | null; target: bigint | null }): { text: string; closeInstead: boolean } | null {
  const { current, maxCr, target } = input;
  if (target === null || current === null) return null;
  if (target <= current) return { text: `Choose a ratio above today's ${formatPercent(current, 0)}.`, closeInstead: false };
  if (maxCr === null) return { text: "Your debt is already at the 1,800 MUSD minimum: close the Trove instead.", closeInstead: true };
  if (target > maxCr)
    return {
      text: `An Unwind reaches at most ${formatPercent(maxCr, 0)} here: past that your debt would fall under the 1,800 MUSD minimum. Close the Trove instead.`,
      closeInstead: true,
    };
  return null;
}

/**
 * The most BTC an Open can bring: the wallet less a gas reserve of the send's budget × 4 at the current
 * gas price (as the BTC entry does: MetaMask on mainnet needs balance ≥ limit × price + value); null
 * while the gas price is unknown, so Max never spends the gas.
 */
export function openBtcMax(walletBtc: bigint, gasPrice: bigint | undefined, network: NetworkConfig): bigint | null {
  if (gasPrice === undefined) return null;
  const reserve = troveGasBudget("open", network) * 4n * gasPrice;
  return walletBtc > reserve ? walletBtc - reserve : 0n;
}

/** Why an Open with this BTC and target has no quote, with the most it reaches (`maxTarget`, after the quote buffer). */
export function openReachNote(input: { btc: bigint | null; cr: bigint | null; maxTarget: bigint | null; quoteFound: boolean }): string | null {
  if (input.btc === null || input.quoteFound) return null;
  const btc = formatToken(input.btc, 18, 6);
  // Under the floor no target works, so this shows before one is typed.
  if (input.maxTarget !== null && input.maxTarget < LEVERAGE_CR_FLOOR)
    return `With ${btc} BTC, a new Trove reaches at most ${formatPercent(input.maxTarget, 1)}, under the ${formatPercent(LEVERAGE_CR_FLOOR, 0)} floor: a Trove needs at least 1,800 MUSD of debt. Add BTC.`;
  if (input.cr === null) return null;
  if (input.maxTarget === null) return `With ${btc} BTC, a Trove at ${formatPercent(input.cr, 0)} is out of reach. Add BTC or choose a lower ratio.`;
  return `With ${btc} BTC, a new Trove reaches at most ${formatPercent(input.maxTarget, 1)}. Choose that or less, or add BTC.`;
}

/** A CR rounded down to 0.1%, so a target at it still quotes. */
function floorTenth(ratio: bigint): bigint {
  const tenth = WAD / 1000n;
  return (ratio / tenth) * tenth;
}

/**
 * The highest target an action quotes, given the most CR it reaches: rounded down to 0.1%, and first divided by the
 * quote buffer when the action quotes above its target (Open and Leverage, `quoteTarget`).
 */
export function maxTarget(maxCr: bigint, buffered: boolean): bigint {
  return floorTenth(buffered ? (maxCr * 10_000n) / (10_000n + QUOTE_CR_BUFFER_BPS) : maxCr);
}

/** `maxTarget` as the target field's text ("247.3"). */
export function maxTargetText(maxCr: bigint, buffered: boolean): string {
  const tenths = maxTarget(maxCr, buffered) / (WAD / 1000n);
  return `${tenths / 10n}.${tenths % 10n}`;
}

/** Presets at or under the highest target; all of them while it is unknown. */
export function presetsWithin(presets: bigint[], highest: bigint | null): bigint[] {
  return highest === null ? presets : presets.filter((p) => p <= highest);
}

export function unwindMaxNote(maxCr: bigint): string {
  return `Up to ${formatPercent(maxTarget(maxCr, false), 1)}: past that your debt would fall under the 1,800 MUSD minimum.`;
}

export function openMaxNote(btc: bigint, highest: bigint): string {
  return `With ${formatToken(btc, 18, 6)} BTC, up to ${formatPercent(highest, 1)}: past that the debt would fall under the 1,800 MUSD minimum.`;
}
