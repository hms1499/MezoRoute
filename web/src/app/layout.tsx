import type { Metadata } from "next";
import type { ReactNode } from "react";
import ClientProviders from "./client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MezoRoute",
  description: "Compare MUSD routes on Mezo and see what each one does to your BTC risk.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
