import type { OverviewRow } from "@/components/flow/Overview";
import { Term } from "@/components/ui/Term";
import { btc, musd } from "@/components/lp/units";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

/** What the deposit does (Flow E step 1), estimated until the receipt: the Confirm card's overview (U11 §6.2). */
export function spConfirmRows(preview: SpDepositPreview, musdIn: bigint): OverviewRow[] {
  return [
    { label: "You deposit", value: musd(musdIn) },
    { label: "Your deposit now", value: musd(preview.depositNow) },
    {
      label: (
        <>
          Pending <Term id="btcGain">BTC gain</Term>
        </>
      ),
      value: btc(preview.gainPaid),
      sub: "Paid to your wallet with this deposit",
    },
    ...(preview.depositAfter !== null ? [{ label: "Deposit after (estimated)", value: musd(preview.depositAfter) }] : []),
    { label: "MezoRoute fee", value: "None (direct protocol call)" },
    { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];
}
