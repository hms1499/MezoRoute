"use client";

import { Check, LoaderCircle, Wallet, X } from "lucide-react";
import type { Step } from "@/lib/tx/stepper";
import { cx } from "@/lib/ui/cx";
import { stepVisual, type StepVisual } from "@/lib/ui/step-visual";
import { Button } from "./Button";

export type StepCopy = { title: string; detail: string; action: string };

const STATUS_TEXT: Partial<Record<StepVisual, string>> = {
  wallet: "Check your wallet…",
  confirming: "Confirming…",
  done: "Done",
};

/** A vertical stepper: numbered nodes joined by a line; status shown with an icon and text, announced politely. */
export function StepList<K extends string>({
  steps,
  active,
  copy,
  blocked,
  onRun,
}: {
  steps: Step<K>[];
  active: number;
  copy: Record<K, StepCopy>;
  blocked: boolean;
  onRun: () => void;
}) {
  return (
    <ol className="mt-4">
      {steps.map((step, index) => {
        const visual = stepVisual(step, index, active);
        const text = STATUS_TEXT[visual];
        const canAct = index === active && (visual === "current" || visual === "failed");
        return (
          <li key={step.kind} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden className={cx("absolute bottom-0 left-4 top-9 w-px", visual === "done" ? "bg-accent" : "bg-line")} />
            )}
            <StepNode visual={visual} number={index + 1} />
            {/* Upcoming steps read muted, not faded: faded text would fall below 4.5:1. */}
            <div className="min-w-0 flex-1 pt-1">
              <p className={cx("text-sm font-semibold", visual === "upcoming" && "text-muted")}>{copy[step.kind].title}</p>
              <p className="mt-0.5 text-sm text-muted">{copy[step.kind].detail}</p>
              {visual === "failed" && step.error && <p className="mt-2 text-sm text-danger">{step.error.message}</p>}
              <div aria-live="polite" className="mt-3 empty:hidden">
                {text && <span className="text-sm font-medium text-muted">{text}</span>}
                {canAct && (
                  <Button disabled={blocked} onClick={onRun}>
                    {visual === "failed" ? "Try again" : copy[step.kind].action}
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepNode({ visual, number }: { visual: StepVisual; number: number }) {
  const base = "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold";
  const ring = "border-2 border-accent bg-surface text-accent";
  switch (visual) {
    case "done":
      return (
        <span className={cx(base, "bg-accent text-onAccent")}>
          <Check aria-hidden className="h-4 w-4" />
        </span>
      );
    case "failed":
      return (
        <span className={cx(base, "bg-danger text-canvas")}>
          <X aria-hidden className="h-4 w-4" />
        </span>
      );
    case "wallet":
      return (
        <span className={cx(base, ring)}>
          <Wallet aria-hidden className="h-4 w-4" />
        </span>
      );
    case "confirming":
      return (
        <span className={cx(base, ring)}>
          <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
        </span>
      );
    case "current":
      return <span className={cx(base, ring)}>{number}</span>;
    case "upcoming":
      return <span className={cx(base, "border border-line bg-surface text-muted")}>{number}</span>;
  }
}
