"use client";

import { Check, Copy, RotateCw, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/lib/ui/cx";
import { MOTION_MS } from "@/lib/ui/motion";

/**
 * U21: an inline icon-only action for a universally understood verb (refresh, copy). The button carries the name
 * (`aria-label`), the glyph is hidden, and the same word shows as a tooltip on hover and keyboard focus (NN/g: a label
 * the person can see; WCAG 4.1.2: a name for assistive tech). The tooltip is `display: none` until shown, so it never
 * widens the page. It sits at the end of a caption line, so it opens up and to the left.
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
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      onClick={onClick}
      className="hit group relative inline-flex shrink-0 items-center justify-center rounded-tip align-middle text-accent hover:text-accent-hover"
    >
      <Icon aria-hidden className={cx(text === "sm" ? "h-4 w-4" : "h-3.5 w-3.5", busy && "motion-safe:animate-spin")} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 z-40 mb-1 hidden whitespace-nowrap rounded-tip border border-line bg-well px-2 py-1 text-xs font-medium text-ink shadow-overlay group-hover:block group-focus-visible:block"
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
        void Promise.resolve(onRefresh())
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    />
  );
}

/** Copies `value`; the glyph turns into a check for the done flash and a polite live region says "Copied". */
export function CopyAction({ value, what, text = "xs" }: { value: string; what: string; text?: "xs" | "sm" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), MOTION_MS.doneFlash);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <>
      <IconAction
        label={`Copy ${what}`}
        text={text}
        icon={copied ? Check : Copy}
        tip={copied ? "Copied" : undefined}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => undefined);
        }}
      />
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}
