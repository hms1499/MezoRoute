"use client";

import dynamic from "next/dynamic";

// The page reads wallet state, so it renders only on the client (wagmi hooks are browser-only).
const Home = dynamic(() => import("@/components/home/Home"), { ssr: false });

export default function Page() {
  return <Home />;
}
