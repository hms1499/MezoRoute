import { cx } from "@/lib/ui/cx";

/** A shimmering placeholder (static under reduced motion); `night` for the dark landing. */
export function Skeleton({ className, tone = "light" }: { className?: string; tone?: "light" | "night" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "block rounded-lg bg-[length:200%_100%] motion-safe:animate-shimmer",
        tone === "night" ? "bg-gradient-to-r from-night-line via-night-panel to-night-line" : "bg-gradient-to-r from-line/70 via-white to-line/70",
        className,
      )}
    />
  );
}

/** A card-shaped placeholder; purely visual, the caller announces the loading state. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("card space-y-3", className)}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** One loading card that screen readers announce. */
export function LoadingCard({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <SkeletonCard lines={lines} />
    </div>
  );
}
