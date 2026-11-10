import type { OverviewRow } from "@/components/flow/Overview";
import { Term } from "@/components/ui/Term";
import { btc, musd } from "@/components/lp/units";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

/** What the deposit does (Flow E step 1), estimated until the receipt: the Confirm card's overview (U11 §6.2). */
export function spConfirmRows(preview: SpDepositPreview, musdIn: bigint): OverviewRow[] {
  return [
    { group: "This deposit", label: "You deposit", value: musd(musdIn) },
    { group: "This deposit", label: "Your deposit now", value: musd(preview.depositNow) },
    {
      group: "This deposit",
      label: (
        <>
          Pending <Term id="btcGain">BTC gain</Term>
        </>
      ),
      value: btc(preview.gainPaid),
      sub: "Paid to your wallet with this deposit",
    },
    ...(preview.depositAfter !== null
      ? [{ group: "This deposit", label: "Deposit after (estimated)", value: musd(preview.depositAfter) }]
      : []),
    { group: "Costs", label: "MezoRoute fee", value: "None (direct protocol call)" },
    { group: "Costs", label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];
}
