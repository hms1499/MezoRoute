// U13 §Exploring (no wallet): the planner quotes the chain, but the wallet's own verdicts are unknown until it
// connects. One pure helper decides what of them the page may show, so the anti-goals ("no Balance 0", "no
// pre-connection insufficient-balance notice", "no network warning before connecting") are testable off the page.

import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";

export type PlannerView = { block: EntryBlock | null; wrongNetwork: boolean };

/**
 * Connected: the gate and the network warning, exactly as U12 shows them. Unconnected: neither — a block the visitor
 * never caused (an empty wallet balance, an unreadable gas price) and a warning about a wallet that is not there
 * would both be wrong.
 */
export function plannerView(input: { connected: boolean; block: EntryBlock | null; walletChainId: number | undefined; chainId: number }): PlannerView {
  if (!input.connected) return { block: null, wrongNetwork: false };
  return { block: input.block, wrongNetwork: input.walletChainId !== input.chainId };
}
