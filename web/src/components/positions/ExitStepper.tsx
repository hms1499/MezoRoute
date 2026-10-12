"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { StepAction } from "@/components/lp/EntryStepper";
import type { ExitBlock } from "@/lib/positions/exit-gate";
import type { ExitStepKind } from "@/lib/positions/exit-steps";
import { hasStarted, type Stepper } from "@/lib/tx/stepper";

const COPY: Record<ExitStepKind, { title: string; detail: string; action: string }> = {
  permit: {
    title: "Sign an LP permit",
    detail: "Lets MezoRoute take exactly this LP in the next step. Signing costs no gas.",
    action: "Sign",
  },
  approve: {
    title: "Approve LP",
    detail: "Your Bitcoin wallet approves the exact LP amount in a separate transaction.",
    action: "Approve",
  },
  exit: {
    title: "Exit to MUSD",
    detail: "One transaction: remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
    action: "Send",
  },
};

export function ExitStepper({
  stepper,
  run,
  restart,
  block,
}: {
  stepper: Stepper<ExitStepKind>;
  run: () => void;
  restart: () => void;
  block: ExitBlock | null;
}) {
  // A failed step, or a block on the pinned amount (e.g. the LP balance changed), needs a way back.
  const stuck = hasStarted(stepper) && (block !== null || stepper.steps.some((step) => step.status === "failed"));
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <BlockNotice block={block} />
        {stuck && (
          <button type="button" onClick={restart} className="ml-auto shrink-0 text-xs font-semibold text-accent hover:underline">
            Start over
          </button>
        )}
      </div>
    </section>
  );
}
