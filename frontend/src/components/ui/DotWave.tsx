import { cx } from "@/lib/ui/cx";

const DELAYS_MS = [0, 150, 300];

/** Three dots rising in turn (U10): waiting on a wallet or a confirmation. Still under reduced motion. */
export function DotWave({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span aria-hidden className={cx("inline-flex items-center", size === "lg" ? "gap-1.5" : "gap-[3px]", className)}>
      {DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className={cx("rounded-full bg-current motion-safe:animate-dot-wave", size === "lg" ? "h-2 w-2" : "h-1 w-1")}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
