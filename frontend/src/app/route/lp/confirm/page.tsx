"use client";

import dynamic from "next/dynamic";
import { FlowPage } from "@/components/flow/FlowPage";

const LpConfirmPage = dynamic(() => import("@/components/lp/LpConfirmPage"), { ssr: false });

export default function Page() {
  return (
    <FlowPage>
      <LpConfirmPage />
    </FlowPage>
  );
}
