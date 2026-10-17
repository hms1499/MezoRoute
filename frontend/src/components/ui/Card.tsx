import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/**
 * A page's content block (U3 §3.3). `panel` is a boxed surface for the page's working objects; `section`
 * is unboxed, under a top hairline, for secondary content. `reference` (mainnet reference data) is a
 * section with a dashed hairline.
 */
export function Card({
  title,
  subtitle,
  aside,
  variant = "default",
  level = "panel",
  headingLevel = 2,
  id,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  variant?: "default" | "reference";
  level?: "panel" | "section";
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
        variant === "reference" ? "border-t border-dashed border-line pt-4" : level === "section" ? "border-t border-line pt-4" : "card",
        "scroll-mt-6",
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            {title && (
              <Heading className={headingLevel === 1 ? "text-title" : "text-base font-semibold"}>{title}</Heading>
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
