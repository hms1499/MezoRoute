"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// Reads the explorer and both networks' RPCs, so it renders only on the client.
const ProofPage = dynamic(() => import("@/components/proof/ProofPage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <ProofPage />
    </Column>
  );
}
