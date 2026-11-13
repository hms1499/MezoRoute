import { Card } from "@/components/ui/Card";
import { CopyAction } from "@/components/ui/IconAction";
import type { SignFact } from "@/lib/flow/sign-facts";

// U13 §Before you sign, generic since U14: what a person gives up the moment they sign, on every flow page's aside.
// The facts come from `src/lib/flow/sign-facts.ts`; null (no contract on this network) renders nothing.

/** U17: the amount cards link here from their trust line below lg. */
export const BEFORE_YOU_SIGN_ID = "before-you-sign";

const LINK = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

/** Label/value rows; a fact with an `href` links out (explorer, repository). */
export function FactList({ facts }: { facts: SignFact[] }) {
  return (
    <dl className="mt-3 space-y-2 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-start justify-between gap-3">
          <dt className="text-muted">{fact.label}</dt>
          <dd className="inline-flex items-center justify-end gap-4 text-right">
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noreferrer" className={LINK}>
                {fact.value}
              </a>
            ) : (
              fact.value
            )}
            {fact.copy && <CopyAction value={fact.copy} what={fact.label.toLowerCase() + " address"} text="sm" />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BeforeYouSign({ facts }: { facts: SignFact[] | null }) {
  if (!facts) return null;
  return (
    <Card id="before-you-sign" title="Before you sign">
      <FactList facts={facts} />
    </Card>
  );
}

/** U17 §7: the card's pointer at the facts, shown only where the aside is stacked under the card (below lg). */
export function TrustLine({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p className="text-xs text-muted lg:hidden">
      {text} ·{" "}
      <a href={`#${BEFORE_YOU_SIGN_ID}`} className={LINK}>
        Before you sign
      </a>
    </p>
  );
}
