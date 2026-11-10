import type { ReactNode } from "react";

/** A wide page's content (Positions): the shell's full width, blocks 16 px apart. Flow routes use `FlowPage`. */
export function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-4">{children}</div>;
}
