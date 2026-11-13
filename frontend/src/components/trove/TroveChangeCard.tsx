import { ChevronRight, ExternalLink, LogOut, SlidersHorizontal, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type { NetworkConfig } from "@/lib/config/networks";
import { MAINNET_NOT_RUN } from "@/lib/leverage/copy";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { formatPercent } from "@/lib/format";

// U21: each action is one row (icon, name, one short line), the whole row the link. The name is never left to the icon
// alone (NN/g: icons for abstract actions need their label); the icon only helps the eye find the row again.
const ROWS: { title: string; href: string; text: string; icon: LucideIcon }[] = [
  { title: "Unwind", href: "/trove/unwind/", text: "Sell BTC to repay debt · higher ratio", icon: TrendingDown },
  { title: "Leverage", href: "/trove/leverage/", text: `Borrow MUSD to buy BTC · never below ${formatPercent(LEVERAGE_CR_FLOOR, 0)}`, icon: TrendingUp },
  { title: "Close", href: "/trove/close/", text: "Repay all with the Trove's BTC · no MUSD needed", icon: LogOut },
];

const ROW = "group -mx-2 flex items-center gap-3 rounded-inset px-2 py-3 transition-colors duration-fast hover:bg-well";

function RowBody({ icon: Icon, title, text, trailing }: { icon: LucideIcon; title: string; text: string; trailing: ReactNode }) {
  return (
    <>
      <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      {trailing}
    </>
  );
}

/** U20 §4: MezoRoute's one-transaction actions on an open Trove; plain changes stay in the Mezo app. */
export function TroveChangeCard({ network }: { network: NetworkConfig }) {
  return (
    <Card title="Change your Trove">
      <p className="mt-1 text-sm leading-relaxed text-muted">
        One transaction each. The next page shows your ratio and risk before and after.
        {network.id === "mainnet" && <> {MAINNET_NOT_RUN}</>}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {network.leverage &&
          ROWS.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className={ROW}>
                <RowBody {...row} trailing={<ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" />} />
              </Link>
            </li>
          ))}
        <li>
          <a href={network.mezoAppUrl} target="_blank" rel="noreferrer" className={ROW}>
            <RowBody
              icon={SlidersHorizontal}
              title="Mezo app"
              text="Add collateral, borrow, or repay"
              trailing={<ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" />}
            />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      </ul>
    </Card>
  );
}
