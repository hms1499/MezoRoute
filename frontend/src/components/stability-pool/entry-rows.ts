// U17 §5: the Stability Pool amount card's rows. Pure, so the anti-goal is tested here: without a wallet nothing is
// shown as the visitor's (no deposit, no pending gain), and the card says what a BTC fall does to the deposit.

import { btc, musdShort } from "@/components/lp/units";
import { formatToken } from "@/lib/format";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

type Row = { label: string; value: string; sub?: string };

/** The label the page swaps for one carrying the BTC gain `Term`. */
export const PENDING_GAIN_LABEL = "Pending BTC gain";

const NOT_MODELLED = "new liquidations not modelled";

export function spEntryRows(input: {
  connected: boolean;
  musdIn: bigint | null;
  preview: Pick<SpDepositPreview, "depositNow" | "gainPaid" | "depositAfter" | "gasCost">;
}): Row[] {
  const { preview, musdIn } = input;
  const account: Row[] = input.connected
    ? [
        ...(musdIn !== null && preview.depositAfter !== null ? [{ label: "Deposit after (estimated)", value: musdShort(preview.depositAfter) }] : []),
        // The current deposit and pending gain show before an amount is typed (U1 deferred: they waited for one).
        { label: "Your deposit now", value: musdShort(preview.depositNow) },
        { label: PENDING_GAIN_LABEL, value: btc(preview.gainPaid), sub: "Paid to your wallet with this deposit" },
      ]
    : [];
  return [
    ...account,
    {
      label: "BTC exposure",
      value: "None until a liquidation",
      sub: musdIn === null ? NOT_MODELLED : `If BTC −30%: ${formatToken(musdIn, 18, 2)} MUSD, unchanged · ${NOT_MODELLED}`,
    },
    { label: "MezoRoute fee", value: "None (direct protocol call)" },
    { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];
}
