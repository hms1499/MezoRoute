import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/** A white surface with an optional header; `reference` marks mainnet reference data (dashed, muted). */
export function Card({
  title,
  subtitle,
  aside,
  variant = "default",
  headingLevel = 2,
  id,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  variant?: "default" | "reference";
  headingLevel?: 1 | 2;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      id={id}
      className={cx(
        variant === "reference" ? "rounded-2xl border border-dashed border-line bg-canvas p-5" : "card",
        "scroll-mt-6",
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            {title && (
              <Heading className={cx("font-semibold tracking-tight", headingLevel === 1 ? "text-xl" : "text-base")}>{title}</Heading>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/** A divided part of a card. */
export function CardSection({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mt-4 border-t border-line pt-4", className)}>{children}</div>;
}
