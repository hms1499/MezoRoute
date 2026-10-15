import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import ClientProviders from "./client-providers";
import "./globals.css";

// Downloaded at build time and served from the export (no runtime request to Google).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MezoRoute",
  description: "Compare MUSD routes on Mezo and see what each one does to your BTC risk.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink tabular-nums antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
