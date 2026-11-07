"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import { encodeFunctionData, type Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, readContract, signTypedData, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError, toastsInStepper } from "@/lib/errors/decode";
import { AMOUNT_TOO_SMALL, PERMIT_EXPIRED } from "@/lib/errors/outcomes";
import { REFINANCE_GAS, troveGasBudget } from "@/lib/quote/gas";
import { DEADLINE_SECONDS } from "@/lib/routes/musd-btc-lp/params";
import { permitTypedData, toExecutorPermit, type SignedPermit } from "@/lib/routes/musd-btc-lp/permit";
import { findHints, ZERO_HINTS, type HintRead, type Hints } from "@/lib/trove/hints";
import { BlockedError } from "@/lib/tx/errors";
import { confirmCall, submitCall, type SendPin } from "@/lib/tx/send";
import { createStepper, hasStarted, stepperReducer, type Stepper } from "@/lib/tx/stepper";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { ORACLE_BOUND_DEFAULT_BPS } from "@/lib/trove/constants";
import { troveActionBlock, type GateQuote } from "./gate";
import { intentQuery, type TroveAction, type TroveIntent } from "./intent";
import { buildCloseCall, buildLeverageCall, buildOpenCall, buildUnwindCall, refinanceCall, type TroveAuth } from "./params";
import { adjustTypedData, closeTypedData, openTypedData } from "./signatures";
import { preSendCheck, quoteFor, type TroveStepKind } from "./steps";
import { nominalCr, type TroveState } from "./trove-math";
import type { TroveData } from "./useTroveSnapshot";

export type TroveFlowInput = {
  action: TroveAction;
  account: Address;
  intent: TroveIntent;
  walletKind: WalletKind;
  plan: TroveStepKind[];
  refresh: () => Promise<TroveData>;
};

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));
const BPS = 10_000n;

type SignedAuth = { quote: GateQuote; nonce: bigint; deadline: bigint; signature: `0x${string}` };

/** Unwind and Close pay the pool in BTC; Leverage and Open in MUSD. */
const permitToken = (action: TroveAction): "btc" | "musd" => (action === "unwind" || action === "close" ? "btc" : "musd");

/** What the wallet pays the pool at most: the signed maximum (plus the fee for MUSD), which the permit covers. */
function permitValue(quote: GateQuote, feeBps: bigint): bigint {
  switch (quote.action) {
    case "unwind":
    case "close":
      return quote.quote.maxBtcToPool;
    case "leverage":
      return quote.quote.debtIncrease;
    case "open":
      return quote.quote ? quote.quote.maxMusdToPool + (quote.quote.maxMusdToPool * feeBps) / BPS : 0n;
  }
}

/** The Trove after the action, for the SortedTroves insert hints; null for Close (no hints). */
function troveAfter(quote: GateQuote): TroveState | null {
  switch (quote.action) {
    case "unwind":
    case "leverage":
      return quote.quote.after;
    case "open":
      return quote.quote?.after ?? null;
    case "close":
      return null;
  }
}

/**
 * Runs a Trove action's stepper: an optional Refinance (a direct BorrowerOperations call), the Trove
 * authorisation (EIP-712, BorrowerOperationsSignatures), the permit for the leg that pays the pool, then
 * the send. The signed amounts are the quote at signing; the send re-checks them against a fresh
 * snapshot, finds hints, simulates (a moved pool fails here with PRICE_MOVED, before any gas), and hands
 * the hash to the receipt page.
 */
export function useTroveFlow(input: TroveFlowInput): { stepper: Stepper<TroveStepKind>; run: () => void } {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError, dismiss } = useErrorToast();
  const [stepper, dispatch] = useReducer(stepperReducer<TroveStepKind>, input.plan, createStepper<TroveStepKind>);
  const stepperRef = useRef(stepper);
  stepperRef.current = stepper;
  const pin = useRef<SendPin | null>(null);
  const auth = useRef<SignedAuth | null>(null);
  const permit = useRef<SignedPermit | null>(null);
  const planKey = input.plan.join(",");
  const feeBps = network.leverage?.feeBps ?? 0n;

  useEffect(() => {
    if (!hasStarted(stepperRef.current)) dispatch({ type: "reset", kinds: planKey.split(",") as TroveStepKind[] });
  }, [planKey]);

  const read: HintRead = (call) => readContract(config, { ...call, chainId: network.chainId } as never);

  async function hintsFor(trove: TroveState | null, troveCount: bigint): Promise<Hints> {
    if (!trove) return ZERO_HINTS;
    return findHints(read, { network, nicr: nominalCr(trove), troveCount, seed: BigInt(Math.floor(Math.random() * 2 ** 32)) });
  }

  /** A fresh quote that passes the gate, or a BlockedError with the reason. */
  function gatedQuote(data: TroveData): GateQuote {
    const quote = quoteFor(input.action, data.snapshot, input.intent, network);
    const block = troveActionBlock({
      action: input.action,
      network,
      walletChainId: getAccount(config).chainId,
      walletKind: input.walletKind,
      snapshot: data.snapshot,
      fetchedAt: data.fetchedAt,
      now: Date.now(),
      quote,
      boundBps: ORACLE_BOUND_DEFAULT_BPS,
    });
    if (block || !quote) throw new BlockedError(block?.outcome ?? AMOUNT_TOO_SMALL);
    return quote;
  }

  async function refinance(sendPin: SendPin) {
    const fresh = await input.refresh();
    const trove = fresh.snapshot.trove;
    if (!trove) throw new BlockedError(AMOUNT_TOO_SMALL);
    const call = refinanceCall(network, await hintsFor(trove, fresh.snapshot.system.troveCount));
    await simulateContract(config, { ...call, account: sendPin.account, chainId: sendPin.chainId });
    const hash = await submitCall(config, { to: call.address, data: encodeFunctionData(call) }, sendPin, REFINANCE_GAS);
    dispatch({ type: "submitted", hash });
    await confirmCall(config, hash, sendPin.chainId);
    dispatch({ type: "confirmed" });
  }

  async function authorise(sendPin: SendPin) {
    const fresh = await input.refresh();
    const quote = gatedQuote(fresh);
    const nonce = fresh.snapshot.bosNonce;
    const deadline = fresh.snapshot.block.timestamp + DEADLINE_SECONDS;
    const base = { network, borrower: sendPin.account, nonce, deadline };
    const typedData =
      quote.action === "unwind"
        ? adjustTypedData({ ...base, collWithdrawal: quote.quote.collWithdrawal, debtChange: quote.quote.debtToRepay, isDebtIncrease: false, assetAmount: 0n })
        : quote.action === "leverage"
          ? adjustTypedData({ ...base, collWithdrawal: 0n, debtChange: quote.quote.debtIncrease, isDebtIncrease: true, assetAmount: quote.quote.btcToAdd })
          : quote.action === "close"
            ? closeTypedData(base)
            : openTypedData({ ...base, assetAmount: quote.btcFromUser + quote.quote!.btcToFlash, debtAmount: quote.quote!.debtAmount });
    const signature = await signTypedData(config, { account: sendPin.account, ...(typedData as object) } as never);
    auth.current = { quote, nonce, deadline, signature };
    permit.current = null; // a new authorisation means new amounts: the permit is signed after it
    dispatch({ type: "signed" });
  }

  async function signPermit(sendPin: SendPin) {
    const signed = auth.current;
    if (!signed) throw new BlockedError(PERMIT_EXPIRED);
    const fresh = await input.refresh();
    const token = permitToken(input.action);
    const nonce = token === "btc" ? fresh.snapshot.btcPermitNonce : fresh.snapshot.musdPermitNonce;
    const value = permitValue(signed.quote, feeBps);
    const typedData = permitTypedData({ network, asset: token, owner: sendPin.account, spender: network.leverage!.address, value, nonce, deadline: signed.deadline });
    const signature = await signTypedData(config, { account: sendPin.account, ...typedData });
    permit.current = { permit: toExecutorPermit(signature, value, signed.deadline), nonce };
    dispatch({ type: "signed" });
  }

  async function send(sendPin: SendPin) {
    const fresh = await input.refresh();
    const blocked = preSendCheck({ snapshot: fresh.snapshot, auth: auth.current, permit: permit.current, permitToken: permitToken(input.action), now: nowSeconds() });
    if (blocked) {
      if (blocked === PERMIT_EXPIRED) {
        auth.current = null;
        permit.current = null;
        dispatch({ type: "signature-expired" });
      }
      throw new BlockedError(blocked);
    }
    const signed = auth.current!;
    const usedPermit = permit.current!.permit;
    // The gate again, on the signed amounts against the fresh snapshot (cap, oracle bound, Recovery Mode).
    const block = troveActionBlock({
      action: input.action,
      network,
      walletChainId: getAccount(config).chainId,
      walletKind: input.walletKind,
      snapshot: fresh.snapshot,
      fetchedAt: fresh.fetchedAt,
      now: Date.now(),
      quote: signed.quote,
      boundBps: ORACLE_BOUND_DEFAULT_BPS,
    });
    if (block) throw new BlockedError(block.outcome ?? AMOUNT_TOO_SMALL);
    const hints = await hintsFor(troveAfter(signed.quote), fresh.snapshot.system.troveCount);
    const troveAuth: TroveAuth = { upperHint: hints.upperHint, lowerHint: hints.lowerHint, signature: signed.signature, deadline: signed.deadline };
    const q = signed.quote;
    const call =
      q.action === "unwind"
        ? buildUnwindCall(network, q.quote, troveAuth, usedPermit, ORACLE_BOUND_DEFAULT_BPS, signed.deadline)
        : q.action === "close"
          ? buildCloseCall(network, q.quote, troveAuth, usedPermit, ORACLE_BOUND_DEFAULT_BPS, signed.deadline)
          : q.action === "leverage"
            ? buildLeverageCall(network, q.quote, troveAuth, usedPermit, input.intent.cr ?? 0n, ORACLE_BOUND_DEFAULT_BPS, signed.deadline)
            : buildOpenCall(network, q.quote!, troveAuth, usedPermit, input.intent.cr ?? 0n, ORACLE_BOUND_DEFAULT_BPS, signed.deadline);
    // A simulated revert is decoded (PRICE_MOVED, Recovery Mode, …) and nothing is sent.
    await simulateContract(config, { ...(call as object), account: sendPin.account, chainId: sendPin.chainId } as never);
    const value = "value" in call ? call.value : undefined;
    const hash = await submitCall(
      config,
      { to: call.address, data: encodeFunctionData(call as never), ...(value === undefined ? {} : { value }) },
      sendPin,
      troveGasBudget(input.action, network),
    );
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
      if (step.kind === "refinance") await refinance(sendPin);
      else if (step.kind === "authorise") await authorise(sendPin);
      else if (step.kind === "permit") await signPermit(sendPin);
      else await send(sendPin);
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
        reduceAmount: () => router.push(`/trove/${input.action}/?${intentQuery(input.action, input.intent)}`),
      });
    }
  }

  return { stepper, run: () => void runActive() };
}
