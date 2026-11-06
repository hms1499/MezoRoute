"use client";

import { Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { SlippageChoice } from "@/components/ui/Presets";
import { formatBps } from "@/lib/format";
import type { SlippageBps } from "@/lib/quote/entry";

// U11 §6.2: slippage moves into a settings popover in the card's top-right (Aerodrome-style). The overlay holds the
// 0.5 / 1 / 2% presets, closes on Escape or a click outside, and Escape returns focus to the trigger.

export function SlippagePopover({
  slippageBps,
  onChange,
  action = "deposit",
}: {
  slippageBps: SlippageBps;
  onChange: (bps: SlippageBps) => void;
  /** What fills below the quote, for the 2% warning ("deposit" or "exit"). */
  action?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    // ml-auto keeps the trigger at the card's right edge when the settings row wraps under the tabs (360 px), so the
    // right-anchored panel opens inside the screen.
    <div ref={root} className="relative ml-auto shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
        className={buttonClass("quiet", "sm")}
      >
        Slippage {formatBps(slippageBps, 1)}
        <Settings aria-hidden className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label="Slippage tolerance"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            close();
          }}
          className="absolute right-0 top-full z-40 mt-2 w-max max-w-[calc(100vw-32px)] space-y-3 rounded-tip border border-line bg-surface p-4 shadow-overlay"
        >
          <p className="text-sm font-medium">Slippage tolerance</p>
          <SlippageChoice value={slippageBps} onChange={onChange} />
          <p className="max-w-60 text-xs text-muted">
            {slippageBps === 200n
              ? `2% slippage lets this ${action} fill up to 2% below the quote. Use it only if lower settings keep failing.`
              : `How far below the quote this ${action} may fill; it reverts beyond that.`}
          </p>
        </div>
      )}
    </div>
  );
}
