import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PairIcon, TokenIcon } from "@/components/ui/TokenIcon";
import { formatToken } from "@/lib/format";

// U11 §6.3: "Your positions". The LP is one row (wallet + staked, split in a caption), the Stability Pool and an open
// Trove follow; each row's action is secondary. No positions gives one neutral row.

type Row = { key: string; icon: ReactNode; name: string; caption?: ReactNode; value: string; earning: string; action: ReactNode };

const musd = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;
const lpAmount = (value: bigint) => formatToken(value, 18, 6);

export function YourPositionsTable({
  lp,
  sp,
  trove,
}: {
  /** null when the account holds no LP; `value` null while it loads. `note` replaces the caption (gauge unreadable). */
  lp: { value: bigint | null; staked: bigint; wallet: bigint; earning: string; note: string | null } | null;
  sp: { value: bigint } | null;
  trove: { debt: bigint; manageHref: string } | null;
}) {
  const manage = (href: string, external = false) => (
    <ButtonLink href={href} external={external} variant="secondary" size="md">
      Manage
    </ButtonLink>
  );
  const rows: Row[] = [
    ...(lp
      ? [
          {
            key: "lp",
            icon: <PairIcon tokens={["musd", "btc"]} size={20} />,
            name: "MUSD/BTC LP",
            caption: lp.note ?? `${lpAmount(lp.staked)} staked · ${lpAmount(lp.wallet)} in wallet`,
            value: lp.value === null ? "—" : musd(lp.value),
            earning: lp.earning,
            action: manage("/positions/"),
          },
        ]
      : []),
    ...(sp ? [{ key: "sp", icon: <TokenIcon token="musd" size={20} />, name: "Stability Pool", value: musd(sp.value), earning: "BTC from liquidations", action: manage("/positions/") }] : []),
    ...(trove
      ? [{ key: "trove", icon: <TokenIcon token="btc" size={20} />, name: "Trove", caption: "Debt, not counted in your positions value", value: `${musd(trove.debt)} debt`, earning: "—", action: manage(trove.manageHref, true) }]
      : []),
  ];
  return (
    <Card title="Your positions">
      <div className="mt-3">
        <DataTable<Row>
          caption="Your positions"
          rows={rows}
          rowKey={(row) => row.key}
          empty="No positions yet. Pick a route to put your MUSD to work."
          columns={[
            {
              key: "position",
              header: "Position",
              align: "left",
              cell: (row) => (
                <span className="inline-flex items-start gap-2">
                  <span className="mt-0.5">{row.icon}</span>
                  <span>
                    <span className="block font-semibold">{row.name}</span>
                    {row.caption && <span className="block text-xs text-muted">{row.caption}</span>}
                  </span>
                </span>
              ),
            },
            { key: "value", header: "Value", align: "right", cell: (row) => row.value },
            { key: "earning", header: "Earning", align: "right", cell: (row) => row.earning },
            { key: "action", header: "", align: "right", action: true, cell: (row) => row.action },
          ]}
        />
      </div>
    </Card>
  );
}
