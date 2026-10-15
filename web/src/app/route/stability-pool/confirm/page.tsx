"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

const SpConfirmPage = dynamic(() => import("@/components/stability-pool/SpConfirmPage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <SpConfirmPage />
    </Column>
  );
}
