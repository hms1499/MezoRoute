/** The page's side gutter (U1): popovers stay this far from the viewport edges. */
const GUTTER = 16;

/**
 * How far to move a popover from its term's left edge so it stays inside the viewport (U8): a term near
 * the right edge of a 360 px phone would otherwise push the page into horizontal scroll.
 */
export function popoverShift({ anchorLeft, width, viewport }: { anchorLeft: number; width: number; viewport: number }): number {
  const left = Math.max(GUTTER, Math.min(anchorLeft, viewport - GUTTER - width));
  return left - anchorLeft;
}
