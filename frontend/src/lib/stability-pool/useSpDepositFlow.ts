"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { ALLOWANCE, AMOUNT_TOO_SMALL } from "@/lib/errors/outcomes";
import { APPROVE_GAS, SP_DEPOSIT_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { encodeProvideCall, encodeSpApproveCall } from "./calls";
import { spDepositPreview } from "./preview";
import type { SpData } from "./snapshot";
import type { SpStepKind } from "./steps";

export type SpDepositFlowInput = {
  account: Address;
  musdIn: bigint;
  walletKind: WalletKind;
  plan: SpStepKind[];
  refresh: () => Promise<SpData>;
};

/**
 * Flow E (spec §9 screen 3b): an exact MUSD approval to the pool when the allowance is short, then
 * `provideToSP`. Account and chain are pinned on the first step; the deposit re-gates on a fresh
 * snapshot, checks the allowance, simulates, submits, and hands the hash to the receipt page.
 */
export function useSpDepositFlow(input: SpDepositFlowInput): { stepper: Stepper<SpStepKind>; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<SpStepKind>, input.plan, createStepper<SpStepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as SpStepKind[] });
  }, [planKey]);

  async function approve(sendPin: SendPin) {
    const hash = await submitCall(config, encodeSpApproveCall(network, input.musdIn), sendPin, APPROVE_GAS);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function deposit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const preview = spDepositPreview({
      network,
      data: fresh,
      musdIn: input.musdIn,
      walletKind: input.walletKind,
      walletChainId: getAccount(config).chainId,
    });
    if (preview.block) throw new BlockedError(preview.block.outcome ?? AMOUNT_TOO_SMALL);
    // The approval may not be visible yet on a lagging node; never send a transfer that would revert.
    if (fresh.snapshot.allowance < input.musdIn) throw new BlockedError(ALLOWANCE);
    // A simulated revert is decoded and nothing is sent.
    await simulateContract(config, {
      address: network.addresses.stabilityPool,
      abi: stabilityPoolAbi,
      functionName: "provideToSP",
      args: [input.musdIn],
      account: sendPin.account,
      chainId: sendPin.chainId,
    });
    const call = { to: network.addresses.stabilityPool, data: encodeProvideCall(input.musdIn) };
    const hash = await submitCall(config, call, sendPin, SP_DEPOSIT_GAS);
    dispatch({ type: "submitted", hash });
    router.push(`/tx/?hash=${hash}`);
  }

  async function runActive() {
    const step = stepperRef.current.steps[stepperRef.current.active];
    if (!step) return;
    pin.current ??= { account: input.account, chainId: network.chainId };
    const sendPin = pin.current;
    dispatch({ type: "start" });
    try {
      if (step.kind === "approve") await approve(sendPin);
      else await deposit(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, { retry: () => void runActive() });
    }
  }

  return { stepper, run: () => void runActive() };
}
