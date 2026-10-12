"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { DEADLINE_SECONDS, encodeApproveCall, NO_PERMIT, type ExecutorPermit } from "@/lib/routes/musd-btc-lp/params";
import { permitUsable, toExecutorPermit } from "@/lib/routes/musd-btc-lp/permit";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import type { ExitIntent } from "./exit-intent";
import { buildExitParams, encodeExitCall } from "./exit-params";
import { exitPreview } from "./exit-preview";
import type { ExitStepKind } from "./exit-steps";
import { lpPermitTypedData } from "./lp-permit";
import type { PositionsData } from "./snapshot";

export type ExitFlowInput = {
  account: Address;
  executor: Address;
  intent: ExitIntent;
  liquidityIn: bigint; // follows the percent until the first step pins it
  walletKind: WalletKind;
  plan: ExitStepKind[];
  refresh: () => Promise<PositionsData>;
};

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

/**
 * The exit stepper (spec §9 screen 6a): LP permit (EOA) or exact LP approval (smart account), then
 * `exit`. The account, chain, and LP amount are pinned on the first step; the send re-quotes,
 * re-gates, simulates, submits, and hands the hash to the receipt page. `restart` drops the pins and
 * the signature ("Start over" / "Change amount"); `pinnedLiquidity` lets the page preview what is sent.
 */
export function useExitFlow(input: ExitFlowInput): {
  stepper: Stepper<ExitStepKind>;
  run: () => void;
  restart: () => void;
  pinnedLiquidity: bigint | null;
} {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<ExitStepKind>, input.plan, createStepper<ExitStepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const pinnedLiquidity = useRef<bigint | null>(null);
  const [pinnedShown, setPinnedShown] = useState<bigint | null>(null);
  const permit = useRef<ExecutorPermit | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as ExitStepKind[] });
  }, [planKey]);

  const liquidityIn = () => pinnedLiquidity.current ?? input.liquidityIn;

  async function signPermit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const deadline = fresh.snapshot.blockTimestamp + DEADLINE_SECONDS;
    const value = liquidityIn();
    const typedData = lpPermitTypedData({
      network,
      owner: sendPin.account,
      spender: input.executor,
      value,
      nonce: fresh.snapshot.permitNonce,
      deadline,
    });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    permit.current = toExecutorPermit(signature, value, deadline);
    dispatch({ type: "signed" });
  }

  async function approve(sendPin: SendPin) {
    const call = { to: network.addresses.pool, data: encodeApproveCall(input.executor, liquidityIn()) };
    const hash = await submitCall(config, call, sendPin);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function exit(sendPin: SendPin) {
    const hasPermitStep = stepperRef.current.steps.some((step) => step.kind === "permit");
    const signed = permit.current;
    if (hasPermitStep && (!signed || !permitUsable(signed, nowSeconds()))) {
      permit.current = null;
      dispatch({ type: "signature-expired" });
      throw new BlockedError(PERMIT_EXPIRED);
    }
    const fresh = await input.refresh();
    const preview = exitPreview({
      network,
      data: fresh,
      intent: input.intent,
      liquidityIn: liquidityIn(),
      walletKind: input.walletKind,
      walletChainId: getAccount(config).chainId,
      now: Date.now(),
    });
    if (preview.block) throw new BlockedError(preview.block.outcome ?? AMOUNT_TOO_SMALL);
    if (!preview.quote || !preview.minimums) throw new BlockedError(AMOUNT_TOO_SMALL);
    const params = buildExitParams(preview.quote, preview.minimums, preview.deadline, sendPin.account);
    const usedPermit = hasPermitStep && signed ? signed : NO_PERMIT;
    // A simulated revert is decoded and nothing is sent.
    await simulateContract(config, {
      address: input.executor,
      abi: mezoRouteExecutorAbi,
      functionName: "exit",
      args: [params, usedPermit],
      account: sendPin.account,
      chainId: sendPin.chainId,
    });
    const hash = await submitCall(config, { to: input.executor, data: encodeExitCall(params, usedPermit) }, sendPin);
    dispatch({ type: "submitted", hash });
    router.push(`/tx/?hash=${hash}`);
  }

  async function runActive() {
    const step = stepperRef.current.steps[stepperRef.current.active];
    if (!step) return;
    pin.current ??= { account: input.account, chainId: network.chainId };
    if (pinnedLiquidity.current === null) {
      pinnedLiquidity.current = input.liquidityIn;
      setPinnedShown(input.liquidityIn);
    }
    const sendPin = pin.current;
    dispatch({ type: "start" });
    try {
      if (step.kind === "permit") await signPermit(sendPin);
      else if (step.kind === "approve") await approve(sendPin);
      else await exit(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, {
        retry: () => void runActive(),
        refreshQuote: () => void input.refresh().catch(() => undefined),
        reduceAmount: restart,
      });
    }
  }

  function restart() {
    pin.current = null;
    pinnedLiquidity.current = null;
    permit.current = null;
    setPinnedShown(null);
    dispatch({ type: "restart", kinds: input.plan });
  }

  return { stepper, run: () => void runActive(), restart, pinnedLiquidity: pinnedShown };
}
