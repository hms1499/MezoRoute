"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

const LpConfirmPage = dynamic(() => import("@/components/lp/LpConfirmPage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <LpConfirmPage />
    </Column>
  );
}
