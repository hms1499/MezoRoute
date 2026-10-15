"use client";

import { useRef, useState } from "react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { Skeleton } from "@/components/ui/Skeleton";
import { amountState } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import { simulateRoutes } from "@/lib/landing/simulate";
import { simulatorNotes, simulatorRows, type SimCell } from "@/lib/landing/view";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { cx } from "@/lib/ui/cx";
import { useCountUp } from "./hooks";
import type { Highlight } from "./Landing";

const PRESETS = [100n, 500n, 1_000n];
const DEFAULT_AMOUNT = 1_000n * WAD;
const EXECUTOR_FEE_BPS = networks.mainnet.executor?.feeBps ?? 0n;

/** U2 hero: both routes for a typed amount on live Mezo mainnet data, no wallet needed. */
export function Simulator({
  data,
  error,
  onHighlight,
}: {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  onHighlight: (highlight: Highlight) => void;
}) {
  const { network } = useNetwork();
  const [text, setText] = useState("1000");
  const lastValid = useRef(DEFAULT_AMOUNT);
  const { amount, error: amountError } = amountState(text);
  if (amount !== null) lastValid.current = amount;
  const shown = amount ?? lastValid.current;
  const sim = data ? simulateRoutes({ reference: data.reference, history: data.history, amount: shown, executorFeeBps: EXECUTOR_FEE_BPS }) : null;
  const column = (route: "lp" | "sp") => ({ onMouseEnter: () => onHighlight(route), onMouseLeave: () => onHighlight(null) });

  return (
    <section aria-labelledby="simulator-heading" className="rounded-2xl border border-night-line bg-night-panel p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-night-muted">
        <h2 id="simulator-heading">simulate · no wallet needed</h2>
        <span className="inline-flex items-center gap-2 text-night-lp">
          <span aria-hidden className="landing-ping h-2 w-2 rounded-full bg-night-lp" />
          Mezo mainnet
        </span>
      </div>

      <label htmlFor="simulator-amount" className="sr-only">
        Amount in MUSD
      </label>
      <div className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-night-line bg-night-bg px-3 focus-within:ring-2 focus-within:ring-night-lp">
        <input
          id="simulator-amount"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="simulator-notes"
          aria-invalid={amountError ? true : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 font-mono text-2xl font-semibold text-night-ink outline-none"
        />
        <span className="font-mono text-xs text-night-muted">MUSD</span>
      </div>
      {amountError && (
        <p role="alert" className="mt-2 text-sm text-night-sp">
          {amountError}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {PRESETS.map((preset) => {
          const on = amount === preset * WAD;
          return (
            <button
              key={preset.toString()}
              type="button"
              aria-pressed={on}
              onClick={() => setText(preset.toString())}
              className={cx(
                "min-h-9 rounded-full border px-3.5 font-mono text-xs transition-colors duration-150",
                on ? "border-night-lp text-night-lp" : "border-night-line text-night-muted hover:text-night-ink",
              )}
            >
              {formatToken(preset * WAD, 18, 0)}
            </button>
          );
        })}
      </div>

      {sim ? (
        <>
          <table className={cx("mt-4 w-full font-mono text-xs", amount === null && "opacity-80")}>
            <caption className="sr-only">Both routes for {formatToken(shown, 18, 2)} MUSD, estimated</caption>
            {/* Below 640 px each row stacks: its label on top, the two routes side by side underneath. */}
            <thead>
              <tr className="max-sm:grid max-sm:grid-cols-2">
                <th scope="col" className="max-sm:hidden">
                  <span className="sr-only">Detail</span>
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold text-night-lp max-sm:pl-0 max-sm:text-left" {...column("lp")}>
                  MUSD/BTC LP
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold text-night-sp" {...column("sp")}>
                  Stability Pool
                </th>
              </tr>
            </thead>
            <tbody>
              {simulatorRows(sim).map((row) => (
                <tr key={row.label} className="border-t border-night-line max-sm:grid max-sm:grid-cols-2">
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal text-night-muted max-sm:col-span-2 max-sm:pb-0">
                    {row.label}
                  </th>
                  <td className={cx("py-2.5 pl-2 text-right break-words max-sm:pl-0 max-sm:text-left max-sm:pt-1", row.lpTone === "btc" ? "text-night-sp" : "text-night-ink")} {...column("lp")}>
                    <Cell cell={row.lp} />
                  </td>
                  <td className="py-2.5 pl-2 text-right text-night-ink break-words max-sm:pt-1" {...column("sp")}>
                    <Cell cell={row.sp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul id="simulator-notes" className="mt-3 space-y-1 text-xs leading-relaxed text-night-muted">
            {simulatorNotes(sim, network.id).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      ) : error ? (
        <div role="status" className="mt-4 flex min-h-[16rem] flex-col justify-center rounded-xl border border-night-line p-4 text-sm">
          <p className="font-semibold text-night-ink">Live data unavailable</p>
          <p id="simulator-notes" className="mt-1 text-night-muted">
            Mezo mainnet could not be read just now. Connect a wallet to compare the routes on your network.
          </p>
        </div>
      ) : (
        <div role="status" aria-busy="true" aria-label="Loading mainnet figures" className="mt-4 min-h-[16rem] space-y-3">
          {/* Same height as the loaded table and notes, so nothing below moves when the data arrives. */}
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} tone="night" className="h-7 w-full" />
          ))}
          <Skeleton tone="night" className="h-8 w-3/4" />
          <span id="simulator-notes" className="sr-only">
            Loading Mezo mainnet figures
          </span>
        </div>
      )}

      <ConnectCta variant="nightOutline" label="Connect wallet to choose a route" className="mt-5 w-full" />
    </section>
  );
}

function Cell({ cell }: { cell: SimCell }) {
  if (cell.kind === "text") return <>{cell.text}</>;
  return <CountingFigure value={cell.value} format={cell.format} />;
}

/** Counts to a new value and flashes once (the key remounts the span to replay the flash). */
function CountingFigure({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  const shown = useCountUp(value, 450);
  return (
    <span key={value.toString()} className="landing-flash rounded px-0.5">
      {format(shown)}
    </span>
  );
}
