"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// U20: reads the wallet's Trove (or the zero address) on the selected network, so it renders only on the client.
const TrovePage = dynamic(() => import("@/components/trove/TrovePage"), { ssr: false });

export default function Page() {
  return (
    <Column>
      <TrovePage />
    </Column>
  );
}
