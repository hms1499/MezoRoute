"use client";

import { useSwitchChain } from "wagmi";
import { useErrorToast } from "@/components/ErrorToast";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlockerMessage } from "@/lib/config/write-gate";

/** Inline rather than a toast: it lasts until the wallet is on the selected network. */
export function WrongNetworkAlert() {
  const { network } = useNetwork();
  const { switchChain, isPending } = useSwitchChain();
  const { showError } = useErrorToast();
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <span>{writeBlockerMessage("wrong-network", network)}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId: network.chainId }, { onError: (error) => showError(error) })}
        className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        Switch network
      </button>
    </div>
  );
}
