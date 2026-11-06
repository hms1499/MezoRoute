"use client";

import { BlockNotice } from "@/components/lp/BlockNotice";
import { Button } from "@/components/ui/Button";
import { StepList, type StepCopy } from "@/components/ui/StepList";
import { Term } from "@/components/ui/Term";
import { exitCopy } from "@/lib/positions/exit-copy";
import type { ExitBlock } from "@/lib/positions/exit-gate";
import type { ExitStepKind } from "@/lib/positions/exit-steps";
import { hasStarted, type Stepper } from "@/lib/tx/stepper";

function stepCopy(plan: ExitStepKind[]): Record<ExitStepKind, StepCopy> {
  return {
    unstake: {
      title: "Unstake LP",
      detail: "One transaction takes the LP you are exiting out of the gauge.",
      action: "Unstake",
    },
    permit: {
      title: (
        <>
          Sign an LP <Term id="permit">permit</Term>
        </>
      ),
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
      detail: exitCopy(plan).exitDetail,
      action: "Send",
    },
  };
}

export function ExitStepper({
  stepper,
  run,
  restart,
  block,
  plan,
}: {
  stepper: Stepper<ExitStepKind>;
  run: () => void;
  restart: () => void;
  block: ExitBlock | null;
  plan: ExitStepKind[];
}) {
  // A failed step, or a block on the pinned amount (e.g. the LP balance changed), needs a way back.
  const stuck = hasStarted(stepper) && (block !== null || stepper.steps.some((step) => step.status === "failed"));
  return (
    <section aria-labelledby="exit-steps">
      <h3 id="exit-steps" className="text-sm font-semibold">
        Steps
      </h3>
      <StepList steps={stepper.steps} active={stepper.active} copy={stepCopy(plan)} blocked={block !== null} onRun={run} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 empty:hidden">
        <BlockNotice block={block} />
        {stuck && (
          <Button variant="ghost" size="md" onClick={restart} className="ml-auto">
            Start over
          </Button>
        )}
      </div>
    </section>
  );
}
