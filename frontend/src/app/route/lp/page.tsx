"use client";

import dynamic from "next/dynamic";
import { FlowPage } from "@/components/flow/FlowPage";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const LpRoutePage = dynamic(() => import("@/components/lp/LpRoutePage"), { ssr: false });

export default function Page() {
  return (
    <FlowPage>
      <LpRoutePage />
    </FlowPage>
  );
}
