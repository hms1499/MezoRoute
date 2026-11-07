import type { NetworkConfig } from "@/lib/config/networks";
import { PERMIT_EXPIRED, TROVE_AUTH_USED, TROVE_RECOVERY_MODE } from "@/lib/errors/outcomes";
import type { Outcome } from "@/lib/errors/types";
import { permitState, type SignedPermit } from "@/lib/routes/musd-btc-lp/permit";
import { leverageSteps, type CapacityCheck, type LeverageStepKind } from "./capacity";
import type { GateQuote } from "./gate";
import type { TroveAction, TroveIntent } from "./intent";
import { quoteClose } from "./quote-close";
import { quoteLeverage } from "./quote-leverage";
import { quoteOpen } from "./quote-open";
import { quoteUnwind } from "./quote-unwind";
import type { TroveSnapshot } from "./snapshot";

export type TroveStepKind = LeverageStepKind;

/** Refinance leads only a Leverage whose capacity needs it; every action then signs, permits and sends. */
export function troveSteps(action: TroveAction, capacity: CapacityCheck): TroveStepKind[] {
  return action === "leverage" ? leverageSteps(capacity) : ["authorise", "permit", "send"];
}

/** A Trove authorisation is sent only with a minute to spare, like a permit. */
export const TROVE_AUTH_MARGIN_SECONDS = 60n;

/** "used" once the BOS nonce moved (submitted elsewhere or replaced), "expired" inside the last minute. */
export function troveAuthState(auth: { nonce: bigint; deadline: bigint }, nowSeconds: bigint, chainNonce: bigint): "usable" | "expired" | "used" {
  if (chainNonce !== auth.nonce) return "used";
  if (nowSeconds + TROVE_AUTH_MARGIN_SECONDS >= auth.deadline) return "expired";
  return "usable";
}

/** The checks just before simulating the send, against a fresh snapshot. */
export function preSendCheck(input: {
  snapshot: TroveSnapshot;
  auth: { nonce: bigint; deadline: bigint } | null;
  permit: SignedPermit | null;
  permitToken: "btc" | "musd";
  now: bigint;
}): Outcome | null {
  const { snapshot } = input;
  if (snapshot.recoveryMode) return TROVE_RECOVERY_MODE;
  const authState = input.auth ? troveAuthState(input.auth, input.now, snapshot.bosNonce) : "expired";
  if (authState === "used") return TROVE_AUTH_USED;
  if (authState === "expired") return PERMIT_EXPIRED;
  const tokenNonce = input.permitToken === "btc" ? snapshot.btcPermitNonce : snapshot.musdPermitNonce;
  if (permitState(input.permit, input.now, tokenNonce) !== "usable") return PERMIT_EXPIRED;
  return null;
}

/** The quote for an action on a snapshot; null without a Trove (or with one, for Open) or the input it needs. */
export function quoteFor(action: TroveAction, snapshot: TroveSnapshot, intent: TroveIntent, network: NetworkConfig): GateQuote | null {
  const { trove, pool, market } = snapshot;
  const feeBps = network.leverage?.feeBps ?? 0n;
  switch (action) {
    case "unwind": {
      const quote = trove && intent.cr !== null ? quoteUnwind(trove, pool, market, intent.cr, intent.slippageBps) : null;
      return quote ? { action, quote } : null;
    }
    case "close":
      return trove ? { action, quote: quoteClose(trove, pool, market, intent.slippageBps) } : null;
    case "leverage": {
      const quote = trove && intent.cr !== null ? quoteLeverage(trove, pool, market, intent.cr, intent.slippageBps, feeBps) : null;
      return quote ? { action, quote } : null;
    }
    case "open": {
      if (trove || intent.btc === null) return null;
      const cap = network.leverage?.maxBtcFlash ?? 0n;
      const quote = intent.cr !== null ? quoteOpen(intent.btc, pool, market, intent.cr, intent.slippageBps, feeBps, cap) : null;
      return { action, btcFromUser: intent.btc, quote };
    }
  }
}
