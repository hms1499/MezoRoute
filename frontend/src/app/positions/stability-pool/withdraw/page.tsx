"use client";

import dynamic from "next/dynamic";
import { FlowPage } from "@/components/flow/FlowPage";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const SpWithdrawPage = dynamic(() => import("@/components/stability-pool/SpWithdrawPage"), { ssr: false });

export default function Page() {
  return (
    <FlowPage>
      <SpWithdrawPage />
    </FlowPage>
  );
}
