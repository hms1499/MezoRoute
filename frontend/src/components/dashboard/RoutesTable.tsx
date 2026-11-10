import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PairIcon, TokenIcon } from "@/components/ui/TokenIcon";
import { formatToken } from "@/lib/format";

// U11 §6.3: "Put your MUSD to work". Both Deposit buttons are secondary: the table compares routes, it does not
// recommend one. The Stability Pool's returns are words, never a rate.

type RouteRow = { name: string; icon: "lp" | "sp"; returns: string; risk: string; href: string };

export function RoutesTable({ lpReturns, walletMusd, lpHref, spHref }: { lpReturns: string; walletMusd: bigint; lpHref: string; spHref: string }) {
  const rows: RouteRow[] = [
    { name: "MUSD/BTC LP", icon: "lp", returns: lpReturns, risk: "About half becomes BTC", href: lpHref },
    { name: "Stability Pool", icon: "sp", returns: "BTC from liquidations", risk: "Stays in MUSD", href: spHref },
  ];
  return (
    <Card title="Put your MUSD to work" subtitle={`In your wallet: ${formatToken(walletMusd, 18, 2)} MUSD`}>
      <div className="mt-3">
        <DataTable<RouteRow>
          caption="Routes for your MUSD"
          rows={rows}
          rowKey={(row) => row.name}
          empty={null}
          columns={[
            {
              key: "route",
              header: "Route",
              align: "left",
              cell: (row) => (
                <span className="inline-flex items-center gap-2">
                  {row.icon === "lp" ? <PairIcon tokens={["musd", "btc"]} size={20} /> : <TokenIcon token="musd" size={20} />}
                  <span className="font-semibold">{row.name}</span>
                </span>
              ),
            },
            { key: "returns", header: "Returns", align: "right", cell: (row) => row.returns },
            { key: "risk", header: "BTC risk", align: "right", cell: (row) => <span className={row.icon === "lp" ? "text-btc" : "text-muted"}>{row.risk}</span> },
            {
              key: "action",
              header: "",
              align: "right",
              action: true,
              cell: (row) => (
                <ButtonLink href={row.href} variant="secondary" size="md">
                  Deposit
                </ButtonLink>
              ),
            },
          ]}
        />
      </div>
      {/* U15: Compare routes is its own page; the Dashboard keeps today's status. */}
      <Link href="/compare/" className="hit mt-3 inline-flex min-h-9 items-center text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
        Compare routes in detail
      </Link>
    </Card>
  );
}
