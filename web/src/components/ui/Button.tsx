import { ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "night" | "nightOutline" | "nightGhost";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-onAccent hover:bg-accent/90 active:bg-accent/80",
  // Inset rings, not borders: the 360 px header has no room for the 2 px a border adds.
  secondary: "text-accent ring-1 ring-inset ring-line hover:bg-accent-soft",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "bg-danger text-canvas hover:bg-danger/90",
  // U2 landing names, now the same look as the app's (U3: one palette).
  night: "bg-accent text-onAccent hover:bg-accent/90 active:bg-accent/80",
  nightOutline: "text-accent ring-1 ring-inset ring-accent hover:bg-accent/10",
  nightGhost: "text-muted hover:text-ink",
};
const SIZES: Record<Size, string> = { md: "min-h-11 px-5 text-sm", sm: "min-h-9 px-3.5 text-xs" };

export function buttonClass(variant: ButtonVariant = "primary", size: Size = "md", className?: string): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], className);
}

type Common = { variant?: ButtonVariant; size?: Size; className?: string; children: ReactNode };

/** The app's one button style; `loading` shows a spinner and disables it. */
export function Button({
  variant,
  size,
  className,
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
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
      {children}
    </button>
  );
}

/** A link styled as a button: `disabled` renders an inert span, `external` opens a new tab. */
export function ButtonLink({
  href,
  external = false,
  disabled = false,
  variant,
  size,
  className,
  children,
}: Common & { href: string; external?: boolean; disabled?: boolean }) {
  const classes = buttonClass(variant, size, className);
  if (disabled) {
    return (
      <span aria-disabled="true" className={classes}>
        {children}
      </span>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
