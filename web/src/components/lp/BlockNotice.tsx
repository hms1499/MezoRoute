import { CircleAlert } from "lucide-react";
import type { Outcome } from "@/lib/errors/types";

/** Why the primary action is disabled, in the §13 wording; nothing when there is no message. */
export function BlockNotice({ block }: { block: { outcome: Outcome | null } | null }) {
  if (!block?.outcome) return null;
  return (
    <p role="status" className="flex items-start gap-1.5 text-sm text-danger">
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{block.outcome.message}</span>
    </p>
  );
}
