import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { SITE_OPEN_GRAPH } from "@/lib/seo/pages";
import { THEME_INIT_SCRIPT } from "@/lib/ui/theme";
import ClientProviders from "./client-providers";
import "./globals.css";

// U11: one font for the whole app, Geist Mono (OFL, src/fonts/OFL.txt), self-hosted because next/font/google in
// Next 14.2.35 has no Geist Mono. The variable file carries every weight the type roles use (300 to 600).
const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

// U14 B5: each route's segment layout sets its own branded title (src/lib/seo/pages.ts); the template brands the 404.
// metadataBase turns /og.png into the absolute URL share cards need. postbuild checks the export (check-metadata).
const description = "Compare MUSD routes on Mezo and see what each one does to your BTC risk.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mezoroute.vercel.app"),
  title: { default: "MezoRoute", template: "%s | MezoRoute" },
  description,
  openGraph: { ...SITE_OPEN_GRAPH, title: "MezoRoute", description },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The head script sets data-theme before React hydrates, hence suppressHydrationWarning (U9).
    <html lang="en" className={geistMono.variable} suppressHydrationWarning>
      <head>
        {/* Before the body paints, so a stored dark theme never flashes light. Light is the CSS default. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
