import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";

/** Why the primary action is disabled, in the §13 wording; nothing when there is no message. */
export function BlockNotice({ block }: { block: EntryBlock | null }) {
  if (!block?.outcome) return null;
  return (
    <p role="status" className="text-xs text-danger">
      {block.outcome.message}
    </p>
  );
}
