"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { Card } from "@/components/ui/Card";
import { StepList } from "@/components/ui/StepList";
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
    <Card title="Confirm">
      <StepList steps={stepper.steps} active={stepper.active} copy={COPY} blocked={block !== null} onRun={run} />
      <p className="mt-4 text-sm text-muted">MezoRoute never holds your MUSD: you call the Stability Pool directly.</p>
      <div className="mt-4 empty:hidden">
        <BlockNotice block={block} />
      </div>
    </Card>
  );
}
