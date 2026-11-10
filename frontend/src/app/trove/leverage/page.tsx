"use client";

import dynamic from "next/dynamic";
import { FlowPage } from "@/components/flow/FlowPage";

const Page = dynamic(() => import("@/components/trove/TrovePages").then((m) => ({ default: () => <m.TroveAmountPage action="leverage" /> })), { ssr: false });

export default function TrovePage() {
  return (
    <FlowPage>
      <Page />
    </FlowPage>
  );
}
