import type { ReactNode } from "react";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";

/** The frame of every page: header, mainnet banner, one content column with a 16 px gutter. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28">
      <Header />
      <MainnetBanner />
      <main className="mt-4 space-y-4">{children}</main>
    </div>
  );
}
