import type { CSSProperties } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §5.8: the user's token icons (public/tokens/, 64 × 64 px PNG), at 16 px inline, 20 px in chips and table rows,
// 24 px in card headers. Every icon is cropped to a circle (MEZO's file is square). Decorative when a label sits beside.

export type Token = "musd" | "btc" | "mezo";
export type TokenIconSize = 16 | 20 | 24;

export function TokenIcon({
  token,
  size,
  label,
  className,
  style,
}: {
  token: Token;
  size: TokenIconSize;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cx("inline-flex shrink-0 overflow-hidden rounded-pill", className)} style={{ width: size, height: size, ...style }}>
      {/* A static export serves these as plain files; next/image would add nothing at 16-24 px. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/tokens/${token}.png`} width={size} height={size} alt={label ?? ""} className="block h-full w-full" />
    </span>
  );
}

/** Two tokens overlapping by a third (the LP pair); the second sits on a ring in the surface colour. */
export function PairIcon({ tokens, size, className }: { tokens: [Token, Token]; size: TokenIconSize; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center", className)}>
      <TokenIcon token={tokens[0]} size={size} />
      <TokenIcon token={tokens[1]} size={size} className="ring-2 ring-surface" style={{ marginLeft: -Math.round(size / 3) }} />
    </span>
  );
}
