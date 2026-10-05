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
    loading: () => <p className="p-6 text-sm text-muted">Loading…</p>,
  },
);

export default ClientProviders;
