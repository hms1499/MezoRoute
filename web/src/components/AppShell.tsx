"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";
import { SurfaceProvider, useSurface } from "./surface";

/**
 * The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`).
 * Below 1024 px the bottom padding (after the footer) keeps everything clear of the route pages' fixed action bar.
 * The landing turns the frame dark through `useDarkSurface` (U2).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SurfaceProvider>
      <Frame>{children}</Frame>
    </SurfaceProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const dark = useSurface() === "dark";
  return (
    <div className={cx("min-h-dvh", dark && "landing-dark bg-night-bg bg-night-glow text-night-ink")}>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-24 sm:px-6 lg:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink focus:shadow-raised"
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
