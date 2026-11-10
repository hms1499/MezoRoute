"use client";

import dynamic from "next/dynamic";
import { Column } from "@/components/ui/Column";

// Reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const LpRoutePage = dynamic(() => import("@/components/lp/LpRoutePage"), { ssr: false });

// The planner is two columns at page width, like Dashboard and Positions (`isFlowPath` lists it as a wide route).
export default function Page() {
  return (
    <Column>
      <LpRoutePage />
    </Column>
  );
}
