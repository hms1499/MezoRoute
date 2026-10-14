"use client";

import dynamic from "next/dynamic";

const SpConfirmPage = dynamic(() => import("@/components/stability-pool/SpConfirmPage"), { ssr: false });

export default function Page() {
  return <SpConfirmPage />;
}
