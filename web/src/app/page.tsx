"use client";

import dynamic from "next/dynamic";

const Spike = dynamic(() => import("./_spike/Spike"), { ssr: false });

export default function Home() {
  return <Spike />;
}
