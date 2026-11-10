import { CircleAlert, Info } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { Outcome } from "@/lib/errors/types";
import { formatToken } from "@/lib/format";
import type { BalanceAction } from "@/lib/routes/balance-recovery";
import type { NoticeAction } from "@/lib/flow/notice-action";

export type { NoticeAction };

/**
 * Why the primary action is disabled, in the §13 wording, and the ways out (U3 §5.4); nothing when there is neither.
 * A block the amount field already says (U14 B3) comes with a null outcome: only its ways out render here.
 */
export function BlockNotice({ block, actions = [] }: { block: { outcome: Outcome | null } | null; actions?: NoticeAction[] }) {
  if (!block?.outcome && actions.length === 0) return null;
  return (
    <div role="status" className="space-y-2">
      {/* U11 §5.5: a "nothing to do" outcome reads neutral, not as an error. */}
      {block?.outcome && (
      <p className={block.outcome.tone === "neutral" ? "flex items-start gap-2 text-sm text-muted" : "flex items-start gap-2 text-sm text-danger"}>
        {block.outcome.tone === "neutral" ? (
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{block.outcome.message}</span>
      </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) =>
            action.href ? (
              <ButtonLink key={action.label} href={action.href} external variant="secondary" size="md">
                {action.label}
              </ButtonLink>
            ) : (
              <Button key={action.label} variant="secondary" size="md" onClick={action.onClick}>
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Buttons for `balanceRecoveries`; the route page supplies what borrowing and using the balance do. */
export function balanceNoticeActions(
  actions: BalanceAction[],
  handlers: { onBorrow?: (amount: bigint) => void; onUseBalance: (amount: bigint) => void },
  unit: "MUSD" | "BTC" = "MUSD",
): NoticeAction[] {
  const digits = unit === "BTC" ? 6 : 2;
  return actions.flatMap((action): NoticeAction[] => {
    switch (action.kind) {
      case "borrow-instead":
        return handlers.onBorrow ? [{ label: "Borrow & Deploy instead", onClick: () => handlers.onBorrow?.(action.amount) }] : [];
      case "use-balance":
        return [
          {
            label: action.capped
              ? `Use the ${formatToken(action.amount, 18, unit === "BTC" ? 4 : 0)} ${unit} cap`
              : `Use my balance (${formatToken(action.amount, 18, digits)} ${unit})`,
            onClick: () => handlers.onUseBalance(action.amount),
          },
        ];
      case "get-musd":
        return [{ label: "Get MUSD in the Mezo app", href: action.href }];
      case "get-btc":
        return [{ label: action.href.includes("faucet") ? "Get test BTC" : "Get BTC in the Mezo app", href: action.href }];
    }
  });
}
