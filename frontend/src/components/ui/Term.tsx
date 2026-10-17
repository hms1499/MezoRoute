"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type TermId } from "@/lib/glossary";
import { popoverShift } from "@/lib/ui/popover";

/** Opening one term closes any other, so at most one definition shows at a time. */
const OPEN_EVENT = "mezoroute:term-open";
/** The landing is prerendered, and React warns about `useLayoutEffect` on the server. */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A Mezo term with its one-sentence definition (U8): a dotted underline that shows the definition on
 * hover, click, tap, or Enter, and closes on a second click, Escape, or a click elsewhere. Screen readers
 * hear the definition as the button's description, open or not. Use it on the first label or heading that
 * names the term on a page, never inside a link, a button, or a form label.
 */
export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapper = useRef<HTMLSpanElement>(null);
  const popover = useRef<HTMLSpanElement>(null);
  const instance = useId();
  const descriptionId = `${instance}-definition`;

  useEffect(() => {
    const onOtherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail === instance) return;
      setOpen(false);
      setPinned(false);
    };
    window.addEventListener(OPEN_EVENT, onOtherOpened);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpened);
  }, [instance]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instance }));
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onPointer = (event: PointerEvent) => !wrapper.current?.contains(event.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, instance]);

  // Measured before paint, so a term near the right edge never pushes the page into horizontal scroll.
  useBeforePaint(() => {
    if (!open || !wrapper.current || !popover.current) return;
    const anchorLeft = wrapper.current.getBoundingClientRect().left;
    setShift(popoverShift({ anchorLeft, width: popover.current.offsetWidth, viewport: document.documentElement.clientWidth }));
  }, [open]);

  return (
    <span
      ref={wrapper}
      className="relative inline-block"
      onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && !pinned && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={descriptionId}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        className="cursor-help rounded-sm text-left underline decoration-accent decoration-dotted underline-offset-4"
      >
        {children}
      </button>
      <span
        ref={popover}
        id={descriptionId}
        role="tooltip"
        style={open ? { transform: `translateX(${shift}px)` } : undefined}
        className={
          open
            ? "absolute left-0 top-full z-40 mt-2 block w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-well p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink"
            : "sr-only"
        }
      >
        {GLOSSARY[id]}
      </span>
    </span>
  );
}
