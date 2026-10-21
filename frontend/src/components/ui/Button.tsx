import { ArrowRight, ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "night" | "nightOutline" | "nightGhost" | "quiet";
type Size = "md" | "sm" | "icon";

// `btn` hooks the U10 roll and arrow rules in globals.css; the press scales under motion-safe only.
const BASE =
  "btn inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[color,background-color,box-shadow,transform] duration-base motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
const PRIMARY = "bg-accent text-onAccent hover:bg-accent-hover active:bg-accent-pressed";
const OUTLINE = "ring-1 ring-inset";
const GHOST = "text-accent hover:bg-accent-soft";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: PRIMARY,
  // Inset rings, not borders: the 360 px header has no room for the 2 px a border adds.
  secondary: `${OUTLINE} text-accent ring-line hover:bg-accent-soft`,
  ghost: GHOST,
  danger: "bg-danger text-canvas hover:bg-danger/90",
  // Landing aliases share the same geometry; the outline keeps an accent ring on the dark surface.
  night: PRIMARY,
  nightOutline: `${OUTLINE} text-accent ring-accent hover:bg-accent-tint`,
  nightGhost: "text-muted hover:text-ink",
  // An outlined control that is not an action: the header's theme toggle (U9).
  quiet: `${OUTLINE} text-muted ring-line hover:text-ink`,
};
const SIZES: Record<Size, string> = { md: "min-h-11 px-5 text-sm", sm: "min-h-9 px-3.5 text-xs", icon: "h-9 w-9 shrink-0" };
// With the arrow circle the trailing padding shrinks so the circle sits inside the pill's curve (Morpho).
const ARROW_SIZES: Record<Size, string> = { md: "min-h-11 pl-5 pr-1.5 text-sm", sm: "min-h-9 pl-3.5 pr-1 text-xs", icon: SIZES.icon };
// Filled buttons carry a light circle with an accent arrow; outlined and ghost ones an accent circle.
const FILLED: ReadonlySet<ButtonVariant> = new Set(["primary", "night"]);

export function buttonClass(variant: ButtonVariant = "primary", size: Size = "md", className?: string, arrow = false): string {
  return cx(BASE, VARIANTS[variant], (arrow ? ARROW_SIZES : SIZES)[size], className);
}

type Common = { variant?: ButtonVariant; size?: Size; className?: string; children: ReactNode; arrow?: boolean };

/**
 * A button's inside (U10): the label twice in a one-line window, so it can roll on hover (the copy is hidden from
 * assistive tech), and an optional arrow circle for buttons that move the user forward. Plain anchors styled with
 * `buttonClass` use it directly.
 */
export function ButtonContent({
  arrow = false,
  variant = "primary",
  size = "md",
  children,
}: {
  arrow?: boolean;
  variant?: ButtonVariant;
  size?: Size;
  children: ReactNode;
}) {
  if (size === "icon") return <>{children}</>;
  return (
    <>
      <span className="btn-roll">
        <span className="btn-label">{children}</span>
        <span className="btn-label" aria-hidden="true">
          {children}
        </span>
      </span>
      {arrow && (
        <span
          className={cx("btn-circle", size === "sm" ? "h-7 w-7" : "h-8 w-8", FILLED.has(variant) ? "bg-onAccent text-accent" : "bg-accent text-onAccent")}
          aria-hidden="true"
        >
          <ArrowRight aria-hidden className="btn-arrow h-4 w-4" />
          <ArrowRight aria-hidden className="btn-arrow h-4 w-4" />
        </span>
      )}
    </>
  );
}

/** The app's one button style; `loading` shows a spinner and disables it. */
export function Button({
  variant,
  size,
  className,
  arrow = false,
  loading = false,
  disabled,
  type = "button",
  children,
  ...rest
}: Common & { loading?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className, arrow)}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
      <ButtonContent arrow={arrow} variant={variant} size={size}>
        {children}
      </ButtonContent>
    </button>
  );
}

/** A link styled as a button: `disabled` renders an inert span, `external` opens a new tab (never with the arrow). */
export function ButtonLink({
  href,
  external = false,
  disabled = false,
  variant,
  size,
  className,
  arrow = false,
  children,
}: Common & { href: string; external?: boolean; disabled?: boolean }) {
  const withArrow = arrow && !external;
  const classes = buttonClass(variant, size, className, withArrow);
  const content = (
    <ButtonContent arrow={withArrow} variant={variant} size={size}>
      {children}
    </ButtonContent>
  );
  if (disabled) {
    return (
      <span aria-disabled="true" className={classes}>
        {content}
      </span>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {content}
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
