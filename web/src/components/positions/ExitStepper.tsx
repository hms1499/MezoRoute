"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepList } from "@/components/ui/StepList";
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
    <Card title="Confirm" className="lg:shadow-raised">
      <StepList steps={stepper.steps} active={stepper.active} copy={COPY} blocked={block !== null} onRun={run} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 empty:hidden">
        <BlockNotice block={block} />
        {stuck && (
          <Button variant="ghost" size="sm" onClick={restart} className="ml-auto">
            Start over
          </Button>
        )}
      </div>
    </Card>
  );
}
