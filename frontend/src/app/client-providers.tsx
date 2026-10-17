"use client";

import dynamic from "next/dynamic";
import { ensureUsableLocalStorage } from "@/lib/config/network-choice";

// Passport and OrangeKit use browser-only APIs, so the wallet tree renders only on the client;
// the static export ships this loading shell. Passport reads localStorage while its module loads,
// so a blocked localStorage is replaced before the import.
const ClientProviders = dynamic(
  () => {
    ensureUsableLocalStorage(window);
    return import("./providers");
  },
  {
    ssr: false,
    loading: () => (
      <div role="status" aria-label="Loading MezoRoute" className="flex min-h-dvh items-center justify-center">
        <span aria-hidden className="h-8 w-8 rounded-lg bg-accent motion-safe:animate-pulse" />
      </div>
    ),
  },
);

export default ClientProviders;
