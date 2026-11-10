import type { ReactNode } from "react";

// U11 §6.1: the flow's one card. Header: the route's icon and name, one figure on the right (this week's APR, the
// pool's swap fee, or the Stability Pool's text). Body: tabs and settings, the inputs, the overview, the page's only
// primary action, and one risk line that links to the details below the card.

export function ActionCard({
  icon,
  title,
  subtitle,
  figure,
  figureLabel,
  tabs,
  settings,
  children,
  risk,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  figure?: ReactNode;
  figureLabel?: ReactNode;
  tabs?: ReactNode;
  settings?: ReactNode;
  children?: ReactNode;
  risk?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <h2 className="whitespace-nowrap text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {(figure || (!tabs && settings)) && (
          <div className="flex flex-col items-start gap-1 sm:shrink-0 sm:items-end">
            {figure && (
              // At 360 the label and the figure shared a line and both wrapped mid-phrase; they stack here and
              // sit side by side, right-aligned, from sm up.
              <div className="text-left sm:text-right">
                {figureLabel && <p className="text-xs text-muted">{figureLabel}</p>}
                <p className="text-sm font-medium">{figure}</p>
              </div>
            )}
            {/* With no tabs (the Trove pages) the settings sit in the header; a row of their own is a lone control
                at the card's right edge with an empty half beside it. */}
            {!tabs && settings}
          </div>
        )}
      </div>
      {tabs && (
        // Below sm the tab track takes the whole line, so the settings stack under it at the left instead of
        // wrapping alone to the right edge.
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1">{tabs}</div>
          {settings && <div className="flex shrink-0 sm:pt-0.5">{settings}</div>}
        </div>
      )}
      {children}
      {action}
      {risk && <p className="text-left text-sm text-muted">{risk}</p>}
    </section>
  );
}
