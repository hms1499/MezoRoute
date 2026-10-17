import { CircleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { Outcome } from "@/lib/errors/types";
import { formatToken } from "@/lib/format";
import type { BalanceAction } from "@/lib/routes/balance-recovery";

export type NoticeAction = { label: string; onClick?: () => void; href?: string };

/** Why the primary action is disabled, in the §13 wording, and the ways out (U3 §5.4); nothing when there is no message. */
export function BlockNotice({ block, actions = [] }: { block: { outcome: Outcome | null } | null; actions?: NoticeAction[] }) {
  if (!block?.outcome) return null;
  return (
    <div role="status" className="space-y-2">
      <p className="flex items-start gap-1.5 text-sm text-danger">
        <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{block.outcome.message}</span>
      </p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) =>
            action.href ? (
              <ButtonLink key={action.label} href={action.href} external variant="secondary" size="sm">
                {action.label}
              </ButtonLink>
            ) : (
              <Button key={action.label} variant="secondary" size="sm" onClick={action.onClick}>
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
): NoticeAction[] {
  return actions.flatMap((action): NoticeAction[] => {
    switch (action.kind) {
      case "borrow-instead":
        return handlers.onBorrow ? [{ label: "Borrow & Deploy instead", onClick: () => handlers.onBorrow?.(action.amount) }] : [];
      case "use-balance":
        return [
          {
            label: action.capped ? `Use the ${formatToken(action.amount, 18, 0)} MUSD cap` : `Use my balance (${formatToken(action.amount, 18, 2)} MUSD)`,
            onClick: () => handlers.onUseBalance(action.amount),
          },
        ];
      case "get-musd":
        return [{ label: "Get MUSD in the Mezo app", href: action.href }];
    }
  });
}
