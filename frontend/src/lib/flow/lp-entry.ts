// U11 §6.2: what the LP amount card shows, computed from the entry preview. Pure, so the page stays a composition and
// the BTC gas reserve on Max (Review Focus 2) and the copy rules (this week's rate, no "$", no "earn") are tested here.

import type { StakeAvailability } from "@/lib/gauge/availability";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import type { EntryAsset } from "@/lib/routes/musd-btc-lp/asset";
import type { EntryMode } from "@/lib/routes/musd-btc-lp/intent";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import type { Token } from "@/components/ui/TokenIcon";
import { tokenAmountMax } from "./amount";

const THIS_WEEK = "At this week's rate";

/**
 * The card header's one figure: this week's APR while staking is on and the APR is known (mainnet, with a MEZO price),
 * the word MEZO without an amount while staked and no price is known (testnet; the amount depends on the field, the
 * header does not), and the pool's swap fee otherwise.
 */
export function lpHeaderFigure(input: {
  stakeOn: boolean;
  availability: StakeAvailability;
  apr: bigint | null;
  poolFeeBps: bigint;
}): { label: string; value: string } {
  const paying = input.stakeOn && input.availability === "open";
  if (paying && input.apr !== null) return { label: THIS_WEEK, value: `≈ ${formatPercent(input.apr, 1)} APR` };
  if (paying) return { label: "Staked LP earns", value: "MEZO" };
  return { label: "Pool", value: `${formatBps(input.poolFeeBps)} swap fee` };
}

export type LpAmountField = {
  token: Token;
  /** MUSD | BTC outside Borrow & Deploy; undefined keeps the chip static. */
  tokens?: Token[];
  label: string;
  balanceLabel: string;
  /** null before a wallet connects: the page shows "Connect to see balance", never a zero. */
  balance: bigint | null;
  /** What Max fills; null while the gas price is unknown (BTC), or before a wallet connects. */
  max: bigint | null;
};

/**
 * The amount field. A BTC entry's Max is the balance less the gas reserve (`tokenAmountMax`), capped by the executor;
 * while the gas price is unknown Max is disabled (the gate blocks the entry). Borrow & Deploy fills the borrow limit.
 */
export function lpAmountField(input: {
  preview: EntryPreview;
  mode: EntryMode;
  asset: EntryAsset;
  walletMusd: bigint;
  /** U13: false on the planner before a wallet connects, when the balance is unknown (not zero). */
  connected?: boolean;
}): LpAmountField {
  const { preview } = input;
  if (input.connected === false) {
    return { token: input.asset, tokens: input.mode === "borrow" ? undefined : ["musd", "btc"], label: "You deposit", balanceLabel: "Balance", balance: null, max: null };
  }
  if (input.mode === "borrow" && preview.borrow) {
    return { token: "musd", label: "You borrow", balanceLabel: "You can borrow", balance: preview.borrow.limit, max: preview.borrow.limit };
  }
  const tokens: Token[] = ["musd", "btc"];
  if (input.asset === "btc" && preview.btc) {
    const fill = tokenAmountMax(preview.btc.walletBtc, preview.btc.fillReserve);
    const max = "blocked" in fill ? null : fill.max < preview.btc.cap ? fill.max : preview.btc.cap;
    return { token: "btc", tokens, label: "You deposit", balanceLabel: "Balance", balance: preview.btc.walletBtc, max };
  }
  return { token: "musd", tokens, label: "You deposit", balanceLabel: "Balance", balance: input.walletMusd, max: input.walletMusd };
}

/** The card's one risk line; the full list sits in Details and on Confirm. */
export function lpRiskLine(input: { borrow: boolean; fromBtc: boolean }): string {
  if (input.borrow) return "Borrowed MUSD adds BTC exposure; impermanent loss and MEZO price risk";
  return "Impermanent loss and MEZO price risk";
}
