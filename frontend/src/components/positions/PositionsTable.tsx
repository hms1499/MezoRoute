import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PairIcon, TokenIcon } from "@/components/ui/TokenIcon";
import { formatToken } from "@/lib/format";
import { GAUGE_READ_FAILED_RETRY, GAUGE_READ_FAILED_SUMMARY } from "@/lib/gauge/copy";

// U11 §6.4: one LP row (wallet + staked together, split in a caption) with the combined Exit, and the Stability Pool
// row with Withdraw. Each row expands to what its card showed before (underlying amounts, share, cost basis).

type Row = { key: string; icon: ReactNode; name: string; caption?: ReactNode; amount: string; value: string; earning: string; action: ReactNode; details: ReactNode };

const musd = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;
const lpAmount = (value: bigint) => formatToken(value, 18, 6);

export function PositionsTable({
  lp,
  sp,
  gaugeReadFailed = false,
}: {
  /** The gauge could not be read: staked LP is unknown, so nothing here may say 0 staked or no positions. */
  gaugeReadFailed?: boolean;
  lp: { amount: bigint; staked: bigint; wallet: bigint; value: bigint; earning: string; exitHref: string; details: ReactNode } | null;
  sp: { deposit: bigint; value: bigint; withdrawHref: string; details: ReactNode } | null;
}) {
  const rows: Row[] = [
    ...(lp
      ? [
          {
            key: "lp",
            icon: <PairIcon tokens={["musd", "btc"]} size={20} />,
            name: "MUSD/BTC LP",
            caption: gaugeReadFailed ? GAUGE_READ_FAILED_SUMMARY : `${lpAmount(lp.staked)} staked · ${lpAmount(lp.wallet)} in wallet`,
            amount: `${lpAmount(lp.amount)} LP`,
            value: musd(lp.value),
            earning: lp.earning,
            action: (
              <ButtonLink href={lp.exitHref} variant="secondary" size="md">
                Exit
              </ButtonLink>
            ),
            details: lp.details,
          },
        ]
      : []),
    ...(sp
      ? [
          {
            key: "sp",
            icon: <TokenIcon token="musd" size={20} />,
            name: "Stability Pool",
            amount: musd(sp.deposit),
            value: musd(sp.value),
            earning: "BTC from liquidations",
            action: (
              <ButtonLink href={sp.withdrawHref} variant="secondary" size="md">
                Withdraw
              </ButtonLink>
            ),
            details: sp.details,
          },
        ]
      : []),
  ];
  return (
    <Card title="Positions">
      <div className="mt-3">
        <DataTable<Row>
          caption="Your positions"
          rows={rows}
          rowKey={(row) => row.key}
          empty={gaugeReadFailed ? GAUGE_READ_FAILED_RETRY : "No positions here."}
          expand={(row) => row.details}
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
            { key: "amount", header: "Amount", align: "right", cell: (row) => row.amount },
            { key: "value", header: "Value", align: "right", cell: (row) => row.value },
            { key: "earning", header: "Earning", align: "right", cell: (row) => row.earning },
            { key: "action", header: "", align: "right", action: true, cell: (row) => row.action },
          ]}
        />
      </div>
    </Card>
  );
}
