"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { entryQuery, type EntryIntent } from "./intent";
import { buildEnterParams, encodeApproveCall, encodeEnterCall, NO_PERMIT, DEADLINE_SECONDS, type ExecutorPermit } from "./params";
import { permitTypedData, permitUsable, toExecutorPermit } from "./permit";
import { entryPreview } from "./preview";
import type { LpRouteData } from "./snapshot";
import type { StepKind } from "./steps";

export type EntryFlowInput = {
  account: Address;
  executor: Address;
  intent: EntryIntent;
  walletKind: WalletKind;
  plan: StepKind[];
  refresh: () => Promise<LpRouteData>;
};

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

/**
 * Runs the confirm stepper: permit (EOA) or exact approval (smart account), then enter. The account
 * and chain are pinned on the first step; enter re-quotes, simulates, submits, and hands the hash
 * to the receipt page.
 */
export function useEntryFlow(input: EntryFlowInput): { stepper: Stepper; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer, input.plan, createStepper);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const permit = useRef<ExecutorPermit | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as StepKind[] });
  }, [planKey]);

  const musdIn = input.intent.musdIn ?? 0n;

  async function signPermit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const deadline = fresh.snapshot.blockTimestamp + DEADLINE_SECONDS;
    const typedData = permitTypedData({
      network,
      owner: sendPin.account,
      spender: input.executor,
      value: musdIn,
      nonce: fresh.snapshot.permitNonce,
      deadline,
    });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    permit.current = toExecutorPermit(signature, musdIn, deadline);
    dispatch({ type: "signed" });
  }

  async function approve(sendPin: SendPin) {
    const hash = await submitCall(config, { to: network.addresses.musd, data: encodeApproveCall(input.executor, musdIn) }, sendPin);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function enter(sendPin: SendPin) {
    const hasPermitStep = stepperRef.current.steps.some((step) => step.kind === "permit");
    const signed = permit.current;
    if (hasPermitStep && (!signed || !permitUsable(signed, nowSeconds()))) {
      permit.current = null;
      dispatch({ type: "signature-expired" });
      throw new BlockedError(PERMIT_EXPIRED);
    }
    const fresh = await input.refresh();
    const preview = entryPreview({
      network,
      data: fresh,
      intent: input.intent,
      walletKind: input.walletKind,
      walletChainId: getAccount(config).chainId,
      now: Date.now(),
    });
    if (preview.block) throw new BlockedError(preview.block.outcome ?? AMOUNT_TOO_SMALL);
    if (!preview.quote || !preview.minimums) throw new BlockedError(AMOUNT_TOO_SMALL);
    const params = buildEnterParams(preview.quote, preview.minimums, preview.deadline, sendPin.account);
    const usedPermit = hasPermitStep && signed ? signed : NO_PERMIT;
    // A simulated revert is decoded and nothing is sent.
    await simulateContract(config, {
      address: input.executor,
      abi: mezoRouteExecutorAbi,
      functionName: "enter",
      args: [params, usedPermit],
      account: sendPin.account,
      chainId: sendPin.chainId,
    });
    const hash = await submitCall(config, { to: input.executor, data: encodeEnterCall(params, usedPermit) }, sendPin);
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
      if (step.kind === "permit") await signPermit(sendPin);
      else if (step.kind === "approve") await approve(sendPin);
      else await enter(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, {
        retry: () => void runActive(),
        refreshQuote: () => void input.refresh().catch(() => undefined),
        reduceAmount: () => router.push(`/route/lp/${entryQuery(input.intent)}`),
      });
    }
  }

  return { stepper, run: () => void runActive() };
}
