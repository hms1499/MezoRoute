"use client";

import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";

/** A failed snapshot read: the decoded message and a Retry button. */
export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { network } = useNetwork();
  return (
    <section role="alert" className="rounded-2xl bg-white p-5 shadow-card">
      <p className="text-sm">{decodeError(error, network).message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
      >
        Retry
      </button>
    </section>
  );
}
