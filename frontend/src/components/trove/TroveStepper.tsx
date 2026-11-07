"use client";

import { StepList, type StepCopy } from "@/components/ui/StepList";
import { Term } from "@/components/ui/Term";
import { BlockNotice } from "@/components/lp/BlockNotice";
import type { TroveBlock } from "@/lib/leverage/gate";
import type { TroveAction } from "@/lib/leverage/intent";
import type { TroveStepKind } from "@/lib/leverage/steps";
import { useTroveFlow, type TroveFlowInput } from "@/lib/leverage/useTroveFlow";

const SEND: Record<TroveAction, { title: string; detail: string }> = {
  unwind: { title: "Unwind in one transaction", detail: "Repays the debt with flashed MUSD, withdraws the BTC to your wallet, and pays the pool from it." },
  close: { title: "Close in one transaction", detail: "Repays the whole debt with flashed MUSD, returns your collateral, and pays the pool from it." },
  leverage: { title: "Leverage in one transaction", detail: "Adds flashed BTC to your Trove, borrows the MUSD that pays for it, and pays the pool." },
  open: { title: "Open in one transaction", detail: "Opens your Trove with your BTC plus flashed BTC, borrows the MUSD that pays for it, and pays the pool." },
};

function stepCopy(action: TroveAction): Record<TroveStepKind, StepCopy> {
  const token = action === "unwind" || action === "close" ? "BTC" : "MUSD";
  return {
    refinance: {
      title: <Term id="refinance">Refinance your Trove</Term>,
      detail: "Resets your borrowing capacity from today's collateral (fee ≈ 0.02% of your debt) and moves the Trove to the current interest rate.",
      action: "Send",
    },
    authorise: {
      title: "Sign the Trove authorisation",
      detail: "Lets MezoRoute make exactly this change to your own Trove, with every result going to your wallet. Signing costs no gas.",
      action: "Sign",
    },
    permit: {
      title: (
        <>
          Sign a {token} <Term id="permit">permit</Term>
        </>
      ),
      detail: `Lets MezoRoute take at most the ${token} the pool needs in the next step; the rest comes back in the same transaction. Signing costs no gas.`,
      action: "Sign",
    },
    send: { ...SEND[action], action: "Send" },
  };
}

export function TroveStepper({ block, ...flow }: TroveFlowInput & { block: TroveBlock | null }) {
  const { stepper, run } = useTroveFlow(flow);
  return (
    <section aria-labelledby="trove-steps">
      <h3 id="trove-steps" className="text-sm font-semibold">
        Steps
      </h3>
      <StepList steps={stepper.steps} active={stepper.active} copy={stepCopy(flow.action)} blocked={block !== null} onRun={run} />
      <div className="mt-4 empty:hidden">
        <BlockNotice block={block} />
      </div>
    </section>
  );
}
