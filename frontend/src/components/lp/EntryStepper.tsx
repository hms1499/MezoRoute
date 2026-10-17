"use client";

import { Card } from "@/components/ui/Card";
import { StepList, type StepCopy } from "@/components/ui/StepList";
import { Term } from "@/components/ui/Term";
import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";
import type { StepKind } from "@/lib/routes/musd-btc-lp/steps";
import { useEntryFlow, type EntryFlowInput } from "@/lib/routes/musd-btc-lp/useEntryFlow";
import { BlockNotice } from "./BlockNotice";

const COPY: Record<StepKind, StepCopy> = {
  permit: {
    title: (
      <>
        Sign a MUSD <Term id="permit">permit</Term>
      </>
    ),
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
    <Card title="Confirm">
      <StepList steps={stepper.steps} active={stepper.active} copy={COPY} blocked={block !== null} onRun={run} />
      <div className="mt-4 empty:hidden">
        <BlockNotice block={block} />
      </div>
    </Card>
  );
}
