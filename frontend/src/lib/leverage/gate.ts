import type { NetworkConfig } from "@/lib/config/networks";
import { QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import type { WalletKind } from "@/lib/wallet/capabilities";
import type { Outcome } from "@/lib/errors/types";
import { troveBlockOutcome } from "./outcomes";
import type { TroveAction } from "./intent";
import { withinOracleBound } from "./oracle-cost";
import type { CloseQuote } from "./quote-close";
import type { LeverageQuote } from "./quote-leverage";
import type { OpenQuote } from "./quote-open";
import { unwindMax, type UnwindQuote } from "./quote-unwind";
import type { TroveSnapshot } from "./snapshot";

export type GateQuote =
  | { action: "unwind"; quote: UnwindQuote }
  | { action: "close"; quote: CloseQuote }
  | { action: "leverage"; quote: LeverageQuote }
  | { action: "open"; btcFromUser: bigint; quote: OpenQuote | null };

export type TroveBlockReason =
  | "not-deployed"
  | "wrong-network"
  | "smart-account"
  | "recovery-mode"
  | "no-trove"
  | "has-trove"
  | "stale-quote"
  | "insufficient-btc"
  | "no-quote"
  | "below-min-debt"
  | "above-cap"
  | "capacity"
  | "oracle-bound";

export type TroveGateInput = {
  action: TroveAction;
  network: NetworkConfig;
  walletChainId: number | undefined;
  walletKind: WalletKind;
  snapshot: TroveSnapshot;
  fetchedAt: number;
  now: number;
  quote: GateQuote | null;
  boundBps: bigint;
};

export type TroveBlock = { reason: TroveBlockReason; outcome: Outcome | null };

const block = (reason: TroveBlockReason, network: NetworkConfig): TroveBlock => ({ reason, outcome: troveBlockOutcome(reason, network) });

/** Why a Trove action cannot be sent now, first reason wins; null when it can. */
export function troveActionBlock(input: TroveGateInput): TroveBlock | null {
  const { action, network, snapshot, quote } = input;
  const leverage = network.leverage;
  if (leverage === null) return block("not-deployed", network);
  if (input.walletChainId !== network.chainId) return block("wrong-network", network);
  // BorrowerOperationsSignatures checks a plain ECDSA signature: Bitcoin wallets (Safes) cannot sign it.
  if (input.walletKind !== "eoa") return block("smart-account", network);
  if (snapshot.recoveryMode) return block("recovery-mode", network);
  if (action === "open" ? snapshot.trove !== null : snapshot.trove === null) return block(action === "open" ? "has-trove" : "no-trove", network);
  if (input.now - input.fetchedAt > QUOTE_TTL_MS) return block("stale-quote", network);
  if (quote?.action === "open" && quote.btcFromUser > snapshot.walletBtc) return block("insufficient-btc", network);
  if (quote === null || quote.quote === null) return block("no-quote", network);

  const price = snapshot.market.price;
  switch (quote.action) {
    case "unwind": {
      const q = quote.quote;
      if (q.debtToRepay > unwindMax(snapshot.trove!)) return block("below-min-debt", network);
      if (q.debtToRepay > leverage.maxMusdFlash) return block("above-cap", network);
      if (!withinOracleBound("sellBtc", q.debtToRepay, q.btcToPool, price, input.boundBps)) return block("oracle-bound", network);
      return null;
    }
    case "close": {
      const q = quote.quote;
      if (q.musdNeeded > leverage.maxMusdFlash) return block("above-cap", network);
      if (!withinOracleBound("sellBtc", q.musdNeeded, q.btcToPool, price, input.boundBps)) return block("oracle-bound", network);
      return null;
    }
    case "leverage": {
      const q = quote.quote;
      if (q.btcToAdd > leverage.maxBtcFlash) return block("above-cap", network);
      if (q.capacity === "blocked") return block("capacity", network);
      if (!withinOracleBound("buyBtc", q.musdToPool, q.btcToAdd, price, input.boundBps)) return block("oracle-bound", network);
      return null;
    }
    case "open": {
      const q = quote.quote;
      if (q.btcToFlash > leverage.maxBtcFlash) return block("above-cap", network);
      if (!withinOracleBound("buyBtc", q.musdToPool, q.btcToFlash, price, input.boundBps)) return block("oracle-bound", network);
      return null;
    }
  }
}
