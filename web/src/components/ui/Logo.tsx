/** Two routes meeting in one node (U1); the same drawing is `app/icon.svg`. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M8 10c5 0 7 6 12 6M8 22c5 0 7-6 12-6h4" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="16" r="2.5" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="hidden text-base font-semibold tracking-tight sm:inline">MezoRoute</span>
    </span>
  );
}
