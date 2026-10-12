"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, readContract, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, BORROW_USED, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { borrowEffect } from "@/lib/trove/borrow";
import { borrowAuthorisationState, borrowTypedData, type BorrowAuthorisation } from "@/lib/trove/borrow-signature";
import { findHints, type HintRead } from "@/lib/trove/hints";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { entryQuery, type EntryIntent } from "./intent";
import {
  buildBorrow,
  buildEnterParams,
  DEADLINE_SECONDS,
  encodeApproveCall,
  encodeBorrowAndEnterCall,
  encodeEnterCall,
  NO_PERMIT,
  type ExecutorPermit,
} from "./params";
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
 * Runs the confirm stepper: permit (EOA) or exact approval (smart account), the borrow authorisation
 * in Borrow & Deploy, then enter or borrowAndEnter. The account and chain are pinned on the first
 * step; the send re-quotes, simulates, submits, and hands the hash to the receipt page.
 */
export function useEntryFlow(input: EntryFlowInput): { stepper: Stepper; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<StepKind>, input.plan, createStepper<StepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const permit = useRef<ExecutorPermit | null>(null);
  const borrowAuth = useRef<BorrowAuthorisation | null>(null);
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

  async function signBorrow(sendPin: SendPin) {
    const fresh = await input.refresh();
    const auth = {
      amount: musdIn,
      nonce: fresh.snapshot.borrowNonce,
      deadline: fresh.snapshot.blockTimestamp + DEADLINE_SECONDS,
    };
    const typedData = borrowTypedData({ network, borrower: sendPin.account, ...auth });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    borrowAuth.current = { ...auth, signature };
    dispatch({ type: "signed" });
  }

  /** The signed borrow authorisation, checked against the fresh nonce before anything else. */
  function usableBorrow(chainNonce: bigint): BorrowAuthorisation {
    const auth = borrowAuth.current;
    const state = auth ? borrowAuthorisationState(auth, nowSeconds(), chainNonce) : "expired";
    // Used elsewhere: the borrowed MUSD is already in the wallet, so the Trove's new debt must not
    // be mistaken for a CR-floor block below.
    if (auth && state === "used") throw new BlockedError(BORROW_USED);
    if (!auth || state === "expired") {
      borrowAuth.current = null;
      dispatch({ type: "signature-expired" });
      throw new BlockedError(PERMIT_EXPIRED);
    }
    return auth;
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
    const borrowing = input.intent.mode === "borrow";
    const auth = borrowing ? usableBorrow(fresh.snapshot.borrowNonce) : null;
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
    let data = encodeEnterCall(params, usedPermit);
    // A simulated revert is decoded and nothing is sent.
    if (auth) {
      const { trove, price, protocol } = fresh.snapshot.dashboard;
      if (!trove) throw new BlockedError(AMOUNT_TOO_SMALL);
      const read: HintRead = (call) => readContract(config, { ...call, chainId: sendPin.chainId } as never);
      const hints = await findHints(read, {
        network,
        nicr: borrowEffect(trove, price, protocol, auth.amount).newNicr,
        troveCount: fresh.snapshot.system.troveCount,
        seed: BigInt(Math.floor(Math.random() * 2 ** 32)),
      });
      const borrow = buildBorrow(auth, hints);
      await simulateContract(config, {
        address: input.executor,
        abi: mezoRouteExecutorAbi,
        functionName: "borrowAndEnter",
        args: [borrow, usedPermit, params],
        account: sendPin.account,
        chainId: sendPin.chainId,
      });
      data = encodeBorrowAndEnterCall(borrow, params, usedPermit);
    } else {
      await simulateContract(config, {
        address: input.executor,
        abi: mezoRouteExecutorAbi,
        functionName: "enter",
        args: [params, usedPermit],
        account: sendPin.account,
        chainId: sendPin.chainId,
      });
    }
    const hash = await submitCall(config, { to: input.executor, data }, sendPin);
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
      else if (step.kind === "borrow") await signBorrow(sendPin);
      else if (step.kind === "approve") await approve(sendPin);
      else await enter(sendPin);
    } catch (error) {
      dispatch({ type: "failed", error: decodeError(error, network) });
      showError(error, {
        retry: () => void runActive(),
        refreshQuote: () => void input.refresh().catch(() => undefined),
        reduceAmount: () => router.push(`/route/lp/${entryQuery(input.intent)}`),
        useDeposit: () => router.push(`/route/lp/${entryQuery({ ...input.intent, mode: "deposit" })}`),
      });
    }
  }

  return { stepper, run: () => void runActive() };
}
