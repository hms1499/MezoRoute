"use client";

import dynamic from "next/dynamic";

const LpConfirmPage = dynamic(() => import("@/components/lp/LpConfirmPage"), { ssr: false });

export default function Page() {
  return <LpConfirmPage />;
}
