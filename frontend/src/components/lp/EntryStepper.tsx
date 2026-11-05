"use client";

import { Card } from "@/components/ui/Card";
import { StepList, type StepCopy } from "@/components/ui/StepList";
import { Term } from "@/components/ui/Term";
import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";
import { enterStepDetail, type StepKind } from "@/lib/routes/musd-btc-lp/steps";
import { useEntryFlow, type EntryFlowInput } from "@/lib/routes/musd-btc-lp/useEntryFlow";
import { BlockNotice } from "./BlockNotice";

/** The steps' copy; the permit and approval name the token the entry brings; the send says what the transaction does. */
function stepCopy(unit: "MUSD" | "BTC", enterDetail: string): Record<StepKind, StepCopy> {
  return {
    permit: {
      title: (
        <>
          Sign a {unit} <Term id="permit">permit</Term>
        </>
      ),
      detail: "Lets MezoRoute take exactly this amount in the next step. Signing costs no gas.",
      action: "Sign",
    },
    approve: {
      title: `Approve ${unit}`,
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
      detail: enterDetail,
      action: "Send",
    },
  };
}

export function EntryStepper({ block, stake, ...flow }: EntryFlowInput & { block: EntryBlock | null; stake: boolean }) {
  const { stepper, run } = useEntryFlow(flow);
  const copy = stepCopy(flow.intent.asset === "btc" ? "BTC" : "MUSD", enterStepDetail({ mode: flow.intent.mode, stake }));
  return (
    <Card title="Confirm">
      <StepList steps={stepper.steps} active={stepper.active} copy={copy} blocked={block !== null} onRun={run} />
      <div className="mt-4 empty:hidden">
        <BlockNotice block={block} />
      </div>
    </Card>
  );
}
