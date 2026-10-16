"use client";

import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";

/**
 * The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`).
 * Below 1024 px the bottom padding (after the footer) keeps everything clear of the route pages' fixed action bar.
 * One dark palette everywhere (U3); the landing adds its own glow behind the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-24 sm:px-6 lg:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <Header />
        <MainnetBanner />
        <main id="main" className="mt-4 flex-1 pb-8">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
