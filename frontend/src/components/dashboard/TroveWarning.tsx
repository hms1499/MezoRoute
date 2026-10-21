import { ButtonContent, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { TroveWarning as Warning } from "@/lib/dashboard/readiness";

/** Persistent while the Trove is unhealthy; it never blocks using wallet MUSD (Flow A). */
export function TroveWarning({ warning }: { warning: Warning }) {
  return (
    <Notice
      tone={warning.tone}
      role="alert"
      action={
        <a href="#exposure" className={buttonClass("secondary", "sm")}>
          <ButtonContent variant="secondary" size="sm">
            Review exposure
          </ButtonContent>
        </a>
      }
    >
      {warning.message}
    </Notice>
  );
}
