"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { countUpAt, isRevealed } from "@/lib/ui/motion";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.(REDUCED).matches === true);
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED);
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * A bigint that eases to `target` over `durationMs` whenever `target` changes. It starts at `initial`
 * (default: `target`, so nothing moves on mount). Under reduced motion it is always `target`.
 */
export function useCountUp(target: bigint, durationMs: number, initial?: bigint): bigint {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(initial ?? target);
  const latest = useRef(shown);
  useEffect(() => {
    if (reduced) {
      latest.current = target;
      setShown(target);
      return;
    }
    const from = latest.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const value = countUpAt(from, target, now - start, durationMs);
      latest.current = value;
      setShown(value);
      if (now - start < durationMs) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return reduced ? target : shown;
}

/** True once `threshold` of the element (or of the viewport, for a tall element) is visible; true at once without IntersectionObserver. */
export function useInView<T extends Element>(threshold = 0.3): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    // Two thresholds: 0 catches a section taller than the viewport, whose ratio never reaches `threshold`.
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries.some((entry) =>
          isRevealed(
            {
              isIntersecting: entry.isIntersecting,
              ratio: entry.intersectionRatio,
              visibleHeight: entry.intersectionRect.height,
              rootHeight: entry.rootBounds?.height ?? window.innerHeight,
            },
            threshold,
          ),
        );
        if (shown) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.1, 0.2, threshold] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, seen]);
  return [ref, seen];
}
