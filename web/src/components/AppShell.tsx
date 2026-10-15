import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";

/** The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <Header />
      <MainnetBanner />
      <main id="main" className="mt-4 flex-1 pb-28 lg:pb-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
