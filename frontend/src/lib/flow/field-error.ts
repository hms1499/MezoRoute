import type { TroveBlock, TroveBlockReason } from "@/lib/leverage/gate";
import type { EntryBlock, EntryBlockReason } from "@/lib/routes/musd-btc-lp/gate";
import type { SpBlock, SpBlockReason } from "@/lib/stability-pool/gate";

// U14 B3: a block the typed amount causes is said at the field itself (`aria-invalid`, the message under it), next
// to what the person just typed. Blocks about the wallet, the network, or the system stay in the page's notice, and
// a field block's recoveries (Use my balance, Borrow & Deploy instead) stay where they are.

const LP_FIELD: readonly EntryBlockReason[] = ["insufficient-balance", "above-cap", "too-small", "above-headroom", "price-impact"];
const SP_FIELD: readonly SpBlockReason[] = ["insufficient-balance", "too-small"];
const TROVE_CR: readonly TroveBlockReason[] = ["above-cap", "capacity", "oracle-bound", "below-min-debt"];

export const PRICE_IMPACT_FIELD = "Price impact above 5%: try a smaller amount.";

/** The LP amount field's error, or null when the block is not about the amount. */
export function lpFieldError(block: EntryBlock | null): string | null {
  if (!block?.outcome || !LP_FIELD.includes(block.reason)) return null;
  return block.reason === "price-impact" ? PRICE_IMPACT_FIELD : block.outcome.message;
}

/** The Stability Pool deposit field's error. */
export function spFieldError(block: SpBlock | null): string | null {
  return block?.outcome && SP_FIELD.includes(block.reason) ? block.outcome.message : null;
}

/**
 * Which Trove field a block belongs to: the BTC an Open puts in, or the target ratio a size limit binds. Null when
 * that field is not on the page (Close has neither), so the page keeps saying it.
 */
export function troveFieldError(block: TroveBlock | null, fields: { btc: boolean; cr: boolean }): { field: "btc" | "cr"; message: string } | null {
  if (!block?.outcome) return null;
  if (block.reason === "insufficient-btc") return fields.btc ? { field: "btc", message: block.outcome.message } : null;
  return TROVE_CR.includes(block.reason) && fields.cr ? { field: "cr", message: block.outcome.message } : null;
}

/**
 * Whether a notice should leave a block's message to the field. `below-min-debt` also keeps its page notice, which
 * carries the Close instead action.
 */
export function isFieldBlock(reason: EntryBlockReason | SpBlockReason | TroveBlockReason): boolean {
  return (
    (LP_FIELD as readonly string[]).includes(reason) ||
    (SP_FIELD as readonly string[]).includes(reason) ||
    reason === "insufficient-btc" ||
    (reason !== "below-min-debt" && (TROVE_CR as readonly string[]).includes(reason))
  );
}
