import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { NetworkConfig } from "@/lib/config/networks";
import { MAINNET_NOT_RUN } from "@/lib/leverage/copy";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { formatPercent } from "@/lib/format";

const ROWS = [
  { title: "Unwind", href: "/trove/unwind/", text: "Sell some of the Trove's BTC to repay debt. Lower debt, higher ratio, less BTC exposure." },
  {
    title: "Leverage",
    href: "/trove/leverage/",
    text: `Borrow more MUSD and buy BTC into the Trove, down to the ratio you choose (never below ${formatPercent(LEVERAGE_CR_FLOOR, 0)}).`,
  },
  { title: "Close", href: "/trove/close/", text: "Repay all debt with the Trove's own BTC and get the rest back. No MUSD needed in the wallet." },
] as const;

/** U20 §4: MezoRoute's one-transaction actions on an open Trove; plain changes stay in the Mezo app. */
export function TroveChangeCard({ network }: { network: NetworkConfig }) {
  return (
    <Card title="Change your Trove">
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Each runs in one transaction: a flash swap of the MUSD/BTC pool, then Mezo&apos;s own Trove call. The next page shows your ratio, liquidation
        price, and risk before and after, then the signatures.
        {network.id === "mainnet" && <> {MAINNET_NOT_RUN}</>}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {network.leverage &&
          ROWS.map((row) => (
            <li key={row.href} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{row.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{row.text}</p>
              </div>
              <ButtonLink href={row.href} variant="secondary" size="md" className="shrink-0">
                {row.title}
              </ButtonLink>
            </li>
          ))}
        <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">Add collateral, borrow, or repay</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Plain Trove changes stay in the Mezo app (Manage loan).</p>
          </div>
          <ButtonLink href={network.mezoAppUrl} external variant="secondary" size="md" className="shrink-0">
            Open Mezo app
          </ButtonLink>
        </li>
      </ul>
    </Card>
  );
}
