"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

const Page = dynamic(() => import("@/components/trove/TrovePages").then((m) => ({ default: () => <m.TroveConfirmPage action="open" /> })), { ssr: false });

export default function TrovePage() {
  return (
    <Column>
      <Page />
    </Column>
  );
}
