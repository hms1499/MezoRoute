"use client";

import dynamic from "next/dynamic";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const SpRoutePage = dynamic(() => import("@/components/stability-pool/SpRoutePage"), { ssr: false });

export default function Page() {
  return <SpRoutePage />;
}
