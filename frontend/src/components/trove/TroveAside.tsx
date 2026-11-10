import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { Overview, type OverviewRow } from "@/components/flow/Overview";
import { Card } from "@/components/ui/Card";
import type { SignFact } from "@/lib/flow/sign-facts";
import type { QueuePosition } from "@/lib/leverage/queue";
import { QueueLine } from "./TroveViews";

/**
 * The Trove pages' aside (U14): the Trove as it stands (amount pages only), the redemption queue before → after
 * (moved out of the card, where it pushed Review below the fold), then Before you sign.
 */
export function TroveAside({
  rows,
  queue,
  facts,
}: {
  rows?: OverviewRow[];
  queue: { before: QueuePosition | null; after: QueuePosition | null };
  facts: SignFact[] | null;
}) {
  return (
    <>
      {rows && (
        <Card title="Your Trove now">
          <Overview rows={rows} className="mt-3" />
        </Card>
      )}
      {(queue.before || queue.after) && (
        <Card>
          <QueueLine before={queue.before} after={queue.after} />
        </Card>
      )}
      <BeforeYouSign facts={facts} />
    </>
  );
}
