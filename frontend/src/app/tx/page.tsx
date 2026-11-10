"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// A static export cannot prerender /tx/[hash], so the hash is a query parameter (S1 decision).
const ReceiptPage = dynamic(() => import("@/components/receipt/ReceiptPage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <ReceiptPage />
    </Column>
  );
}
