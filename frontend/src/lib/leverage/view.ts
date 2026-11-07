import type { OverviewRow } from "@/components/flow/Overview";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { EVM_ONLY, MAINNET_NOT_RUN, RECOVERY_MODE_BLOCK } from "./copy";
import type { GateQuote, TroveBlockReason } from "./gate";
import type { TroveAction } from "./intent";
import type { TroveSnapshot } from "./snapshot";
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
