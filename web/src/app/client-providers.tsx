"use client";

import dynamic from "next/dynamic";

// Passport and OrangeKit use browser-only APIs, so the wallet tree renders only on the client;
// the static export ships this loading shell.
const ClientProviders = dynamic(() => import("./providers"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-500">Loading wallet…</p>,
});

export default ClientProviders;
