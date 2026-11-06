"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import type { Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, readContract, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError, toastsInStepper } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, BORROW_USED, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { borrowEffect } from "@/lib/trove/borrow";
import { borrowAuthorisationState, borrowTypedData, type BorrowAuthorisation } from "@/lib/trove/borrow-signature";
import { findHints, type HintRead } from "@/lib/trove/hints";
import { APPROVE_GAS, borrowEnterGas, ENTER_BTC_GAS, ENTER_BTC_STAKE_GAS, ENTER_GAS, ENTER_STAKE_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { entryQuery, intentAmount, type EntryIntent } from "./intent";
import {
  approveCall,
  buildBorrow,
  buildEnterFromBtcParams,
  buildEnterParams,
  DEADLINE_SECONDS,
  encodeBorrowAndEnterCall,
  encodeEnterCall,
  encodeEnterFromBtcCall,
  NO_PERMIT,
} from "./params";
import { permitState, permitTypedData, toExecutorPermit, type SignedPermit } from "./permit";
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
 * Runs the confirm stepper: permit (EOA) or exact approval (smart account) for the entry's token (MUSD, or
 * BTC for a BTC entry), the borrow authorisation in Borrow & Deploy, then enter, borrowAndEnter, or enterFromBtc. The account and chain are pinned on the first
 * step; the send re-quotes, simulates, submits, and hands the hash to the receipt page.
 */
export function useEntryFlow(input: EntryFlowInput): { stepper: Stepper; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError, dismiss } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<StepKind>, input.plan, createStepper<StepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const permit = useRef<SignedPermit | null>(null);
  const borrowAuth = useRef<BorrowAuthorisation | null>(null);
  const planKey = input.plan.join(",");

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as StepKind[] });
  }, [planKey]);

  const asset = input.intent.asset;
  // The entry's amount in its own token: MUSD, or BTC for a BTC entry.
  const amountIn = intentAmount(input.intent) ?? 0n;
  const musdIn = input.intent.musdIn ?? 0n; // Borrow & Deploy only
  const token = asset === "btc" ? network.addresses.btc : network.addresses.musd;
  const tokenNonce = (snapshot: LpRouteData["snapshot"]) => (asset === "btc" ? snapshot.btcPermitNonce : snapshot.permitNonce);

  async function signPermit(sendPin: SendPin) {
    const fresh = await input.refresh();
    const deadline = fresh.snapshot.blockTimestamp + DEADLINE_SECONDS;
    const nonce = tokenNonce(fresh.snapshot);
    const typedData = permitTypedData({
      network,
      asset,
      owner: sendPin.account,
      spender: input.executor,
      value: amountIn,
      nonce,
      deadline,
    });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    permit.current = { permit: toExecutorPermit(signature, amountIn, deadline), nonce };
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
    const hash = await submitCall(config, approveCall(token, input.executor, amountIn), sendPin, APPROVE_GAS);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function enter(sendPin: SendPin) {
    const hasPermitStep = stepperRef.current.steps.some((step) => step.kind === "permit");
    const fresh = await input.refresh();
    // Expired, or spent elsewhere (the nonce moved): sign again rather than send a permit the executor would skip.
    const signed = hasPermitStep && permitState(permit.current, nowSeconds(), tokenNonce(fresh.snapshot)) === "usable" ? permit.current : null;
    if (hasPermitStep && !signed) {
      permit.current = null;
      dispatch({ type: "signature-expired" });
      throw new BlockedError(PERMIT_EXPIRED);
    }
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
    const usedPermit = signed ? signed.permit : NO_PERMIT;
    if (preview.btcQuote && preview.btcMinimums) {
      // A BTC entry: the permit (or approval) is for BTC, and the call is enterFromBtc.
      const btcParams = buildEnterFromBtcParams(preview.btcQuote, preview.btcMinimums, preview.deadline, sendPin.account, preview.stake.on);
      await simulateContract(config, {
        address: input.executor,
        abi: mezoRouteExecutorAbi,
        functionName: "enterFromBtc",
        args: [btcParams, usedPermit],
        account: sendPin.account,
        chainId: sendPin.chainId,
      });
      const btcHash = await submitCall(
        config,
        { to: input.executor, data: encodeEnterFromBtcCall(btcParams, usedPermit) },
        sendPin,
        preview.stake.on ? ENTER_BTC_STAKE_GAS : ENTER_BTC_GAS,
      );
      dispatch({ type: "submitted", hash: btcHash });
      router.push(`/tx/?hash=${btcHash}`);
      return;
    }
    if (!preview.quote || !preview.minimums) throw new BlockedError(AMOUNT_TOO_SMALL);
    const params = buildEnterParams(preview.quote, preview.minimums, preview.deadline, sendPin.account, preview.stake.on);
    let data = encodeEnterCall(params, usedPermit);
    let gasBudget = preview.stake.on ? ENTER_STAKE_GAS : ENTER_GAS;
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
      gasBudget = borrowEnterGas(hints.found, preview.stake.on);
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
    const hash = await submitCall(config, { to: input.executor, data }, sendPin, gasBudget);
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
      const decoded = decodeError(error, network);
      dispatch({ type: "failed", error: decoded });
      if (!toastsInStepper(decoded)) {
        dismiss();
        return;
      }
      showError(error, {
        retry: () => void runActive(),
        refreshQuote: () => void input.refresh().catch(() => undefined),
        reduceAmount: () => router.push(`/route/lp/${entryQuery(input.intent)}`),
        skipStake: () => router.push(`/route/lp/${entryQuery({ ...input.intent, stake: false })}`),
        useDeposit: () => router.push(`/route/lp/${entryQuery({ ...input.intent, mode: "deposit" })}`),
      });
    }
  }

  return { stepper, run: () => void runActive() };
}
