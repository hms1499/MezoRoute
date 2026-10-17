"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const SpRoutePage = dynamic(() => import("@/components/stability-pool/SpRoutePage"), { ssr: false });

export default function Page() {
  return (
    <Column width="wide">
      <SpRoutePage />
    </Column>
  );
}
