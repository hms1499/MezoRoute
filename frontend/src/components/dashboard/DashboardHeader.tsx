/** U11 §5.2: the Dashboard's h1, with the connected wallet as its caption (moved from the Next step card). */
export function DashboardHeader({ wallet, title }: { wallet: string; title?: string }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h1 className="text-title">Dashboard</h1>
      <p className="text-xs text-muted" title={title}>
        {wallet}
      </p>
    </header>
  );
}
