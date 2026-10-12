"use client";

import Link from "next/link";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlockerMessage } from "@/lib/config/write-gate";

export function NoExecutorCard() {
  const { network } = useNetwork();
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <p className="text-sm">{writeBlockerMessage("no-executor", network)}</p>
      <Link href="/" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
        Back to dashboard
      </Link>
    </section>
  );
}
