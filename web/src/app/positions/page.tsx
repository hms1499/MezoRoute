"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const PositionsPage = dynamic(() => import("@/components/positions/PositionsPage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <PositionsPage />
    </Column>
  );
}
