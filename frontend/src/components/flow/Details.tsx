"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { isHashTarget } from "@/lib/ui/hash-target";

// U11 §6.1: the disclosure under the action card (What happens, the "If BTC moves" chart, the full risk list),
// closed by default on the amount page. The card's one risk line links here (`#details`), and U12 makes that link
// open the disclosure instead of scrolling to a closed one.

export function Details({
  id = "details",
  summary = "Details",
  defaultOpen = false,
  children,
}: {
  id?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openFor = (hash: string) => {
      const element = ref.current;
      if (element && isHashTarget(hash, id)) element.open = true;
    };
    openFor(window.location.hash);
    const onHash = () => openFor(window.location.hash);
    // The same hash does not fire `hashchange`, so a second click after closing is handled here too.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement) openFor(anchor.hash);
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, [id]);

  return (
    <details ref={ref} id={id} open={defaultOpen || undefined} className="group scroll-mt-6 border-t border-line pt-4">
      <summary className="hit flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown aria-hidden className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  );
}
