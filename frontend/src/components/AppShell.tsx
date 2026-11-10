"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FLOW_WIDTH, isFlowPath } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainnetBanner } from "./MainnetBanner";

/**
 * The frame of every page: skip link, header, mainnet banner, the page, footer. Pages set their own width (`Column`
 * on wide pages, `FlowPage` on flow routes). On a flow route the banner takes the flow column's width, so the page
 * has one left edge under the header. Light or dark everywhere (U9, `data-theme` on <html>); the landing adds its own
 * glow behind the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const flow = isFlowPath(usePathname());
  return (
    <div className="flex min-h-dvh flex-col">
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
        {/* `w-full`: an auto-margined flex item would otherwise shrink to its content. */}
        <div className={cx("w-full", flow && cx("mx-auto", FLOW_WIDTH))}>
          <MainnetBanner />
        </div>
        <main id="main" className="mt-4 flex-1 pb-8">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
