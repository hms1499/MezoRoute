import type { ReactNode } from "react";

/** A secondary pill button that opens another site (faucet, Mezo app) in a new tab. */
export function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-block rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-accent hover:bg-accent-soft"
    >
      {children}
    </a>
  );
}
