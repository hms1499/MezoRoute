"use client";

import { useSwitchChain } from "wagmi";
import { useErrorToast } from "@/components/ErrorToast";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlockerMessage } from "@/lib/config/write-gate";

/** Inline rather than a toast: it lasts until the wallet is on the selected network. */
export function WrongNetworkAlert() {
  const { network } = useNetwork();
  const { switchChain, isPending } = useSwitchChain();
  const { showError } = useErrorToast();
  return (
    <Notice
      tone="danger"
      role="alert"
      action={
        <Button
          size="sm"
          loading={isPending}
          onClick={() => switchChain({ chainId: network.chainId }, { onError: (error) => showError(error) })}
        >
          Switch network
        </Button>
      }
    >
      {writeBlockerMessage("wrong-network", network)}
    </Notice>
  );
}
