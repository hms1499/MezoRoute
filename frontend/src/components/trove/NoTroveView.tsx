import type { ReactNode } from "react";
import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { ConnectCta } from "@/components/home/ConnectCta";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import type { NetworkConfig } from "@/lib/config/networks";
import { troveSignFacts } from "@/lib/flow/sign-facts";
import { formatPercent, formatToken } from "@/lib/format";
import { MAINNET_NOT_RUN } from "@/lib/leverage/copy";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { GAS_COMPENSATION, LEVERAGE_CR_FLOOR, MIN_NET_DEBT } from "@/lib/trove/constants";
import type { OpenFacts } from "@/lib/trove/page";
import { cx } from "@/lib/ui/cx";
import { MezoNowCard } from "./TroveAsideCards";

const STEPS = [
  { title: "Open with leverage", text: "Bring BTC, borrow MUSD, and buy more BTC into the new Trove in one go." },
  { title: "Leverage", text: "Borrow more and buy BTC into the Trove, down to the ratio you choose." },
  { title: "Unwind", text: "Sell some of the Trove's BTC to repay debt and lower the risk." },
  { title: "Close", text: "Repay everything with the Trove's own BTC and get the rest back." },
];

/** U20 §5: no Trove (or no wallet yet): what Mezo asks, what MezoRoute adds, and the two risks, all read without a wallet. */
export function NoTroveView({ snapshot, open, connected, network }: { snapshot: TroveSnapshot; open: OpenFacts; connected: boolean; network: NetworkConfig }) {
  const lev = network.leverage;
  const floor = formatPercent(LEVERAGE_CR_FLOOR, 0);
  const openLink = lev && (
    <ButtonLink href="/trove/open/" variant={connected ? "primary" : "secondary"} arrow={connected}>
      Open with leverage
    </ButtonLink>
  );
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Open a Trove">
          <p className="mt-1 text-sm text-muted">What Mezo asks of every Trove, read now.</p>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact label="Minimum debt" value={`${formatToken(open.minDebt, 18, 0)} MUSD`}>
              {formatToken(MIN_NET_DEBT, 18, 0)} borrowed + {formatToken(GAS_COMPENSATION, 18, 0)} MUSD gas deposit, returned on close
            </Fact>
            <Fact label="Collateral ratio" value={`${formatPercent(snapshot.market.mcr, 0)} min`}>
              Mezo suggests 150% or more; MezoRoute&apos;s Open and Leverage keep {floor} or more
            </Fact>
            <Fact label="Cost" value={`${formatPercent(open.rateBps * 10n ** 14n, 0)} a year`}>
              interest, plus a {formatPercent(open.borrowingRate)} borrowing fee
            </Fact>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {connected ? openLink : <ConnectCta label="Connect to see your Trove" />}
            {!connected && openLink}
            <ButtonLink href={network.mezoAppUrl} external variant="secondary">
              Open in the Mezo app
            </ButtonLink>
          </div>
          {lev && (
            <Notice tone="warning" className="mt-4">
              Open with leverage needs at least {formatToken(open.minDebt, 18, 0)} MUSD of debt
              {open.minOwnBtc !== null && <>, so about {formatToken(open.minOwnBtc, 18, 4, "up")} BTC of your own at {floor}</>}.
              {network.id === "mainnet" && (
                <>
                  {" "}
                  {MAINNET_NOT_RUN} The flash swap is capped at {formatToken(lev.maxBtcFlash, 18, 4)} BTC per transaction.
                </>
              )}
            </Notice>
          )}
        </Card>
        <Card title="What MezoRoute does with a Trove">
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Mezo&apos;s app changes a Trove one step at a time. MezoRoute adds a flash swap, so each of these is one transaction.
          </p>
          <ol className="mt-2 divide-y divide-line">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3 py-4">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Two risks to know">
          <dl className="mt-2 divide-y divide-line">
            <Risk label="Liquidation" level="high">
              Below {formatPercent(snapshot.market.mcr, 0)} anyone can liquidate the Trove: the debt is cancelled and you lose the BTC. Interest raises that line
              slowly even if BTC stands still.
            </Risk>
            <Risk label="Redemption" level="medium">
              Anyone can swap MUSD for BTC from the lowest-ratio Troves. Your debt and BTC both shrink at the oracle price; it is not a loss like a
              liquidation.
            </Risk>
          </dl>
        </Card>
      </div>
      <aside className="space-y-6">
        <MezoNowCard snapshot={snapshot} withPrice />
        {lev && (
          <BeforeYouSign
            facts={troveSignFacts(network, { feeBps: lev.feeBps, maxBtcFlash: lev.maxBtcFlash, maxMusdFlash: lev.maxMusdFlash, blockNumber: snapshot.block.number })}
          />
        )}
      </aside>
    </div>
  );
}

function Fact({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="rounded-inset bg-well p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="block text-xl font-medium">{value}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{children}</span>
      </dd>
    </div>
  );
}

function Risk({ label, level, children }: { label: string; level: "high" | "medium"; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
      <dt className="inline-flex shrink-0 items-center gap-2 self-start font-semibold sm:w-32">
        <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", level === "high" ? "bg-danger" : "bg-warning-ink")} />
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-muted">{children}</dd>
    </div>
  );
}
