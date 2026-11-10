import type { ReactNode } from "react";

/** Every page's content (U14: one page width): the shell's full width, blocks 16 px apart. Flows add `FlowColumn`. */
export function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-4">{children}</div>;
}
