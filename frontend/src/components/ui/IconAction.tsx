"use client";

import { Check, Copy, RotateCw, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/lib/ui/cx";
import { MOTION_MS } from "@/lib/ui/motion";

// The tooltip shows on hover (only where the device can hover, so a tap never leaves it stuck) and on keyboard focus,
// and hides on Escape (WCAG 1.4.13). A named group, so an ancestor's `.group` (Details, RiskList, Disclosure) never
// opens it.
const TIP_SHOWN = "[@media(hover:hover)]:group-hover/icon:block group-focus-visible/icon:block";

/**
 * U21: an inline icon-only action for a universally understood verb (refresh, copy). The button carries the name
 * (`aria-label`), the glyph is hidden, and the same word shows as a tooltip on hover and keyboard focus (NN/g: a label
 * the person can see; WCAG 4.1.2: a name for assistive tech). The tooltip is `display: none` until shown, so it never
 * widens the page. It sits at the end of a caption line or a value, so it opens up and to the left.
 */
export function IconAction({
  label,
  icon: Icon,
  onClick,
  busy = false,
  tip,
  text = "xs",
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  busy?: boolean;
  /** What the tooltip says when it differs from the name (a confirmation such as "Copied"). */
  tip?: string;
  /** The size of the text beside it: 12 px gets a 14 px glyph, 14 px a 16 px one (U10 §8). */
  text?: "xs" | "sm";
}) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      onClick={onClick}
      onKeyDown={(event) => event.key === "Escape" && setDismissed(true)}
      onBlur={() => setDismissed(false)}
      onPointerLeave={() => setDismissed(false)}
      className="hit group/icon relative inline-flex shrink-0 items-center justify-center rounded-tip align-middle text-accent hover:text-accent-hover"
    >
      <Icon aria-hidden className={cx(text === "sm" ? "h-4 w-4" : "h-3.5 w-3.5", busy && "motion-safe:animate-spin")} />
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute bottom-full right-0 z-40 mb-1 hidden whitespace-nowrap rounded-tip border border-line bg-well px-2 py-1 text-xs font-medium text-ink shadow-overlay",
          !dismissed && TIP_SHOWN,
        )}
      >
        {tip ?? label}
      </span>
    </button>
  );
}

/** Refetches; spins while the returned promise is in flight (the U20 review's missing in-flight state). */
export function RefreshAction({ onRefresh }: { onRefresh: () => unknown }) {
  const [busy, setBusy] = useState(false);
  return (
    <IconAction
      label="Refresh"
      icon={RotateCw}
      busy={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        // `.then`, so a synchronous throw also ends in `finally` and never leaves the button busy.
        void Promise.resolve()
          .then(onRefresh)
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    />
  );
}

type CopyState = "idle" | "copied" | "failed";
const COPY_SAID: Record<Exclude<CopyState, "idle">, string> = { copied: "Copied", failed: "Copy failed" };

/** Copies `value`; the glyph turns into a check for the done flash and a polite live region says "Copied" (or that it failed). */
export function CopyAction({ value, what, text = "xs" }: { value: string; what: string; text?: "xs" | "sm" }) {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), MOTION_MS.doneFlash);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <>
      <IconAction
        label={`Copy ${what}`}
        text={text}
        icon={state === "copied" ? Check : Copy}
        tip={state === "idle" ? undefined : COPY_SAID[state]}
        onClick={() => {
          // No clipboard (an insecure context, a frame without permission) or a refused write both say so.
          const write = navigator.clipboard ? navigator.clipboard.writeText(value) : Promise.reject(new Error("no clipboard"));
          void write.then(
            () => setState("copied"),
            () => setState("failed"),
          );
        }}
      />
      <span aria-live="polite" className="sr-only">
        {state === "idle" ? "" : COPY_SAID[state]}
      </span>
    </>
  );
}
