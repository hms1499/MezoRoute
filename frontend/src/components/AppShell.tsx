"use client";

import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";

/**
 * The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`).
 * Below 1024 px a route page's fixed action bar (`data-mobile-bar`) gets bottom padding to clear the footer;
 * pages without one (the landing) end at the footer.
 * Light or dark everywhere (U9, `data-theme` on <html>); the landing adds its own glow behind the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col max-lg:has-[[data-mobile-bar]]:pb-24">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <div className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Header />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        <MainnetBanner />
        <main id="main" className="mt-4 flex-1 pb-8">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
