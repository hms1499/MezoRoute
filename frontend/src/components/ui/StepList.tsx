"use client";

import { Check, LoaderCircle, Wallet, X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/tx/stepper";
import { cx } from "@/lib/ui/cx";
import { MOTION_MS } from "@/lib/ui/motion";
import { PENDING_TEXT } from "@/lib/ui/pending";
import { newlyDone, stepVisual, type StepVisual } from "@/lib/ui/step-visual";
import { Button } from "./Button";

export type StepCopy = { title: ReactNode; detail: string; action: string };

const STATUS_TEXT: Partial<Record<StepVisual, string>> = PENDING_TEXT;

/**
 * The kind of the step that just finished, for `MOTION_MS.doneFlash` (U10: its button shows the check and "Done"
 * briefly, then the row returns to the plain finished row). Cleared on unmount, so no update lands after it. If the
 * finished button held keyboard focus, focus moves to the next step's button instead of falling back to the page.
 */
function useDoneFlash<K extends string>(steps: Step<K>[], list: RefObject<HTMLOListElement>): K | null {
  // Derived during render (React's "previous props" pattern), not in an effect: an effect would commit one render
  // with the step done and no flash, unmounting the focused button before the "Done" button replaces it.
  const [previous, setPrevious] = useState(steps);
  const [flash, setFlash] = useState<K | null>(null);
  if (steps !== previous) {
    const done = newlyDone(previous, steps);
    setPrevious(steps);
    if (done.length > 0) setFlash(done[done.length - 1]);
  }
  useEffect(() => {
    if (flash === null) return;
    const timer = setTimeout(() => {
      const held = list.current?.querySelector('[data-pending="done"]')?.contains(document.activeElement) ?? false;
      setFlash(null);
      if (held) requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(".btn:not([data-pending])")?.focus());
    }, MOTION_MS.doneFlash);
    return () => clearTimeout(timer);
  }, [flash, list]);
  return flash;
}

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
  const list = useRef<HTMLOListElement>(null);
  const flash = useDoneFlash(steps, list);
  return (
    <ol ref={list} className="mt-4">
      {steps.map((step, index) => {
        const visual = stepVisual(step, index, active);
        const text = STATUS_TEXT[visual];
        const canAct = index === active && (visual === "current" || visual === "failed" || visual === "cancelled");
        const pending = pendingFor(visual, step.kind === flash);
        return (
          <li key={step.kind} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden className={cx("absolute bottom-0 left-4 top-9 w-px", visual === "done" ? "bg-accent" : "bg-line")} />
            )}
            <StepNode visual={visual} />
            {/* Upcoming steps read muted, not faded: faded text would fall below 4.5:1. */}
            <div className="min-w-0 flex-1 pt-1">
              <p className={cx("text-sm font-semibold", visual === "upcoming" && "text-muted")}>{copy[step.kind].title}</p>
              <p className="mt-0.5 text-sm text-muted">{copy[step.kind].detail}</p>
              {visual === "failed" && step.error && <p className="mt-2 text-sm text-danger">{step.error.message}</p>}
              {visual === "cancelled" && step.error && <p className="mt-2 text-sm text-muted">{step.error.message}</p>}
              {/* The live region announces the status; the button beside it shows the same status visually (U10). It
                  stays rendered while empty: a region that enters the accessibility tree with its text is not announced. */}
              <div aria-live="polite" className={text && !pending ? "mt-3" : "sr-only"}>
                {text && <span className="text-sm font-medium text-muted">{text}</span>}
              </div>
              {(canAct || pending) && (
                <div className="mt-3">
                  <Button disabled={blocked && canAct} pending={pending} onClick={onRun}>
                    {visual === "failed" ? "Try again" : copy[step.kind].action}
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The button's pending phase on a step's row: waiting, confirming, or a step that just finished. */
function pendingFor(visual: StepVisual, flashing: boolean): "wallet" | "confirming" | "done" | null {
  if (visual === "wallet" || visual === "confirming") return visual;
  return visual === "done" && flashing ? "done" : null;
}

/** Status glyphs only: the page header's Amount → Confirm → Done is the one numbered sequence (U3 §5.5). */
function StepNode({ visual }: { visual: StepVisual }) {
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
    case "cancelled":
      return (
        <span className={cx(base, ring)}>
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
      );
    case "upcoming":
      return <span className={cx(base, "border border-muted/60 bg-surface")} />;
  }
}
