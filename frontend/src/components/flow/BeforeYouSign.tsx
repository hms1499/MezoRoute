import { Card } from "@/components/ui/Card";
import type { SignFact } from "@/lib/flow/sign-facts";

// U13 §Before you sign, generic since U14: what a person gives up the moment they sign, on every flow page's aside.
// The facts come from `src/lib/flow/sign-facts.ts`; null (no contract on this network) renders nothing.

const LINK = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

/** Label/value rows; a fact with an `href` links out (explorer, repository). */
export function FactList({ facts }: { facts: SignFact[] }) {
  return (
    <dl className="mt-3 space-y-2 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-start justify-between gap-3">
          <dt className="text-muted">{fact.label}</dt>
          <dd className="text-right">
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noreferrer" className={LINK}>
                {fact.value}
              </a>
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BeforeYouSign({ facts }: { facts: SignFact[] | null }) {
  if (!facts) return null;
  return (
    <Card title="Before you sign">
      <FactList facts={facts} />
    </Card>
  );
}
