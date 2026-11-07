"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { useConfig } from "wagmi";
import { readContract, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { useNetwork } from "@/lib/config/network-context";
import { CLAIM_COLLATERAL_GAS, REPAY_GAS } from "@/lib/quote/gas";
import { findHints, type HintRead } from "@/lib/trove/hints";
import { confirmCall, submitCall } from "@/lib/tx/send";
import { claimCollateralCall, repayCall } from "./params";
import { nominalCr, troveAfter, type TroveState } from "./trove-math";

export type DirectCall = { kind: "claim" } | { kind: "repay"; amount: bigint; trove: TroveState; troveCount: bigint };

/**
 * Claim surplus BTC (`claimCollateral`) or repay from the wallet (`repayMUSD`, allowed in Recovery Mode):
 * direct BorrowerOperations calls from any wallet type, simulated first; on confirmation every read refetches.
 */
export function useDirectTroveCall(account: Address): { run: (call: DirectCall) => void; pending: DirectCall["kind"] | null } {
  const config = useConfig();
  const { network } = useNetwork();
  const queryClient = useQueryClient();
  const { showError } = useErrorToast();
  const [pending, setPending] = useState<DirectCall["kind"] | null>(null);

  async function send(input: DirectCall) {
    const pin = { account, chainId: network.chainId };
    setPending(input.kind);
    try {
      let call;
      let gas;
      if (input.kind === "claim") {
        call = claimCollateralCall(network);
        gas = CLAIM_COLLATERAL_GAS;
      } else {
        const read: HintRead = (c) => readContract(config, { ...c, chainId: network.chainId } as never);
        const after = troveAfter(input.trove, { collDelta: 0n, debtDelta: -input.amount, feeOnIncrease: 0n });
        const hints = await findHints(read, { network, nicr: nominalCr(after), troveCount: input.troveCount, seed: BigInt(Math.floor(Math.random() * 2 ** 32)) });
        call = repayCall(network, input.amount, hints);
        gas = REPAY_GAS;
      }
      await simulateContract(config, { ...(call as object), account: pin.account, chainId: pin.chainId } as never);
      const hash = await submitCall(config, { to: call.address, data: encodeFunctionData(call as never) }, pin, gas);
      await confirmCall(config, hash, pin.chainId);
      await queryClient.invalidateQueries();
    } catch (error) {
      showError(error, { retry: () => void send(input) });
    } finally {
      setPending(null);
    }
  }

  return { run: (call) => void send(call), pending };
}
