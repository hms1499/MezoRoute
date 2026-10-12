"use client";

import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";
import type { StepKind } from "@/lib/routes/musd-btc-lp/steps";
import { useEntryFlow, type EntryFlowInput } from "@/lib/routes/musd-btc-lp/useEntryFlow";
import type { Step } from "@/lib/tx/stepper";
import { BlockNotice } from "./BlockNotice";

const COPY: Record<StepKind, { title: string; detail: string; action: string }> = {
  permit: {
    title: "Sign a MUSD permit",
    detail: "Lets MezoRoute take exactly this amount in the next step. Signing costs no gas.",
    action: "Sign",
  },
  approve: {
    title: "Approve MUSD",
    detail: "Your Bitcoin wallet approves the exact amount in a separate transaction.",
    action: "Approve",
  },
  borrow: {
    title: "Sign the borrow authorisation",
    detail: "Lets MezoRoute borrow exactly this amount from your Trove to your own wallet, inside the deposit transaction. Signing costs no gas.",
    action: "Sign",
  },
  enter: {
    title: "Deposit into the pool",
    detail: "One transaction: fee, swap, and add liquidity. Leftovers return to you.",
    action: "Send",
  },
};

export function EntryStepper({ block, ...flow }: EntryFlowInput & { block: EntryBlock | null }) {
  const { stepper, run } = useEntryFlow(flow);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Confirm</h2>
      <ol className="mt-3 space-y-3">
        {stepper.steps.map((step, index) => (
          <li key={step.kind} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
            <div>
              <p className="text-sm font-semibold">
                {index + 1}. {COPY[step.kind].title}
              </p>
              <p className="text-xs text-muted">{COPY[step.kind].detail}</p>
              {step.status === "failed" && step.error && <p className="mt-1 text-xs text-danger">{step.error.message}</p>}
            </div>
            <StepAction step={step} active={index === stepper.active} disabled={block !== null} label={COPY[step.kind].action} onRun={run} />
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <BlockNotice block={block} />
      </div>
    </section>
  );
}

export function StepAction({
  step,
  active,
  disabled,
  label,
  onRun,
}: {
  step: Step<string>;
  active: boolean;
  disabled: boolean;
  label: string;
  onRun: () => void;
}) {
  if (step.status === "done") return <span className="shrink-0 text-xs font-semibold text-accent">Done</span>;
  if (step.status === "awaiting-wallet") return <span className="shrink-0 text-xs text-muted">Check your wallet…</span>;
  if (step.status === "submitted") return <span className="shrink-0 text-xs text-muted">Confirming…</span>;
  if (!active) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRun}
      className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
    >
      {step.status === "failed" ? "Try again" : label}
    </button>
  );
}
