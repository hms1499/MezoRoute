// U13 §Exploring (no wallet): the planner quotes the chain, but the wallet's own verdicts are unknown until it
// connects. One pure helper decides what of them the page may show, so the anti-goals ("no Balance 0", "no
// pre-connection insufficient-balance notice", "no network warning before connecting") are testable off the page.

import { entryBlock, type EntryBlock, type EntryBlockReason, type EntryGateInput } from "@/lib/routes/musd-btc-lp/gate";

export type PlannerView = { block: EntryBlock | null; wrongNetwork: boolean };

/** U17 §3: the blocks the typed amount causes and the chain alone decides. Every other reason is about a wallet. */
export const PLANNER_AMOUNT_BLOCKS: readonly EntryBlockReason[] = ["above-cap", "too-small", "price-impact"];

/**
 * The verdict the chain gives the amount with no wallet in the picture. `entryBlock` checks the balance before the
 * cap, so with a zero-address balance it would answer "insufficient balance" first; here it is asked with the
 * wallet's side neutralised (it holds exactly the amount, has gas, sits on the selected network, and is not
 * borrowing), and only an answer about the amount itself is kept. `entryBlock` is not changed.
 */
export function plannerAmountBlock(input: EntryGateInput): EntryBlock | null {
  const block = entryBlock({
    ...input,
    walletChainId: input.network.chainId,
    walletMusd: input.musdIn ?? 0n,
    lacksGas: false,
    quoteAgeMs: 0,
    borrow: null,
    btc: input.btc ? { ...input.btc, walletBtc: input.btc.btcIn ?? 0n, gasReserve: 0n } : input.btc,
  });
  return block && PLANNER_AMOUNT_BLOCKS.includes(block.reason) ? block : null;
}

/**
 * Connected: the gate and the network warning, exactly as U12 shows them. Unconnected: only `amountBlock`, the
 * amount's own refusal (U17) — a block the visitor never caused (an empty wallet balance, an unreadable gas price)
 * and a warning about a wallet that is not there would both be wrong.
 */
export function plannerView(input: {
  connected: boolean;
  block: EntryBlock | null;
  amountBlock: EntryBlock | null;
  walletChainId: number | undefined;
  chainId: number;
}): PlannerView {
  if (!input.connected) return { block: input.amountBlock, wrongNetwork: false };
  // wagmi reports an account before the chain it sits on: a wallet whose network is still unknown is not on the wrong one.
  return { block: input.block, wrongNetwork: input.walletChainId !== undefined && input.walletChainId !== input.chainId };
}
