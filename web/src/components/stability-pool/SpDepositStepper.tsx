"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { StepAction } from "@/components/lp/EntryStepper";
import type { SpBlock } from "@/lib/stability-pool/gate";
import type { SpStepKind } from "@/lib/stability-pool/steps";
import { useSpDepositFlow, type SpDepositFlowInput } from "@/lib/stability-pool/useSpDepositFlow";

const COPY: Record<SpStepKind, { title: string; detail: string; action: string }> = {
  approve: {
    title: "Approve MUSD",
    detail: "Lets the Stability Pool take exactly this amount, in a separate transaction.",
    action: "Approve",
  },
  deposit: {
    title: "Deposit into the Stability Pool",
    detail: "One transaction: the pool takes your MUSD and pays any pending BTC gain to your wallet. No MezoRoute fee.",
    action: "Send",
  },
};

export function SpDepositStepper({ block, ...flow }: SpDepositFlowInput & { block: SpBlock | null }) {
  const { stepper, run } = useSpDepositFlow(flow);
  return (
    <section className="card">
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
      <p className="mt-3 text-xs text-muted">MezoRoute never holds your MUSD: you call the Stability Pool directly.</p>
      <div className="mt-2">
        <BlockNotice block={block} />
      </div>
    </section>
  );
}
