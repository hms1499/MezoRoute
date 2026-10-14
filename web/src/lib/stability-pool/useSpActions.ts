"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import type { ExitPercent } from "@/lib/positions/exit-intent";
import { SP_WITHDRAW_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { submitCall, type SendPin } from "@/lib/tx/send";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { encodeWithdrawCall } from "./calls";
import { spClaimPreview, spWithdrawPreview } from "./preview";
import type { SpData } from "./snapshot";

/**
 * Flow H and the BTC-gain claim: one direct `withdrawFromSP` each (a claim is `withdrawFromSP(0)`).
 * Each send refreshes, re-gates, simulates (a paused pool is decoded and nothing is sent), submits,
 * and hands the hash to the receipt page. Max is recomputed from the fresh compounded deposit.
 */
export function useSpActions(
  account: Address,
  refresh: () => Promise<SpData>,
): { withdraw: (percent: ExitPercent) => void; claim: () => void; pending: "withdraw" | "claim" | null } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const walletKind = useWalletKind();
  const { showError } = useErrorToast();
  const [pending, setPending] = useState<"withdraw" | "claim" | null>(null);

  async function send(kind: "withdraw" | "claim", percent: ExitPercent) {
    const pin: SendPin = { account, chainId: network.chainId };
    setPending(kind);
    try {
      const fresh = await refresh();
      const walletChainId = getAccount(config).chainId;
      let amount = 0n;
      if (kind === "withdraw") {
        const preview = spWithdrawPreview({ network, data: fresh, percent, walletKind: walletKind ?? "unknown", walletChainId });
        if (preview.block?.outcome) throw new BlockedError(preview.block.outcome);
        amount = preview.amount;
      } else {
        const block = spClaimPreview({ network, data: fresh, walletChainId });
        if (block?.outcome) throw new BlockedError(block.outcome);
      }
      await simulateContract(config, {
        address: network.addresses.stabilityPool,
        abi: stabilityPoolAbi,
        functionName: "withdrawFromSP",
        args: [amount],
        account: pin.account,
        chainId: pin.chainId,
      });
      const hash = await submitCall(config, { to: network.addresses.stabilityPool, data: encodeWithdrawCall(amount) }, pin, SP_WITHDRAW_GAS);
      router.push(`/tx/?hash=${hash}`);
    } catch (error) {
      showError(error, { retry: () => void send(kind, percent) });
    } finally {
      setPending(null);
    }
  }

  return {
    withdraw: (percent) => void send("withdraw", percent),
    claim: () => void send("claim", 100),
    pending,
  };
}
