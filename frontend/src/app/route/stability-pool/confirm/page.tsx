"use client";

import dynamic from "next/dynamic";
import { FlowPage } from "@/components/flow/FlowPage";

const SpConfirmPage = dynamic(() => import("@/components/stability-pool/SpConfirmPage"), { ssr: false });

export default function Page() {
  return (
    <FlowPage>
      <SpConfirmPage />
    </FlowPage>
  );
}
