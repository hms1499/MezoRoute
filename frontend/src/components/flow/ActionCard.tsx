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
        {figure && (
          <div className="flex items-baseline justify-between gap-2 sm:block sm:shrink-0 sm:text-right">
            {figureLabel && <p className="text-xs text-muted">{figureLabel}</p>}
            <p className="text-sm font-medium">{figure}</p>
          </div>
        )}
      </div>
      {(tabs || settings) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {tabs ?? <span />}
          {settings}
        </div>
      )}
      {children}
      {action}
      {risk && <p className="text-left text-sm text-muted">{risk}</p>}
    </section>
  );
}
