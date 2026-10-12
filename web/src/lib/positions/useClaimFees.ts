"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { useConfig } from "wagmi";
import { simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { poolAbi } from "@/lib/abi/pool";
import { useNetwork } from "@/lib/config/network-context";
import { submitCall } from "@/lib/tx/send";
import { assertClaimable } from "./claim";

/** Flow G2: the user calls `Pool.claimFees()` directly (simulated first); the receipt decodes `Claim`. */
export function useClaimFees(account: Address): { claim: () => void; pending: boolean } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [pending, setPending] = useState(false);

  async function run() {
    const pin = { account, chainId: network.chainId };
    setPending(true);
    try {
      const { result } = await simulateContract(config, {
        address: network.addresses.pool,
        abi: poolAbi,
        functionName: "claimFees",
        account: pin.account,
        chainId: pin.chainId,
      });
      assertClaimable(result);
      const data = encodeFunctionData({ abi: poolAbi, functionName: "claimFees" });
      const hash = await submitCall(config, { to: network.addresses.pool, data }, pin);
      router.push(`/tx/?hash=${hash}`);
    } catch (error) {
      showError(error, { retry: () => void run() });
    } finally {
      setPending(false);
    }
  }

  return { claim: () => void run(), pending };
}
