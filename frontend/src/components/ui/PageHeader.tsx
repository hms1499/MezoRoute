import { ArrowLeft, Check, Clock, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { cx } from "@/lib/ui/cx";
import type { StepStatus } from "@/lib/ui/step-visual";

type Labels = readonly [string, string, string];
const DEFAULT_LABELS: Labels = ["Amount", "Confirm", "Done"];

/** Back link, flow progress (① ─ ② ─ ③), and the page title for route, confirm, and receipt pages. */
export function PageHeader({
  back,
  title,
  step,
  stepStatus,
  labels = DEFAULT_LABELS,
}: {
  back: { href: string; label: string };
  title?: string;
  step?: 1 | 2 | 3;
  /** The current step's state, when it is a transaction (the receipt's Done step). */
  stepStatus?: StepStatus;
  labels?: Labels;
}) {
  return (
    <div className="space-y-3">
      <Link href={back.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full text-sm font-medium text-muted hover:text-accent">
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {back.label}
      </Link>
      {step && <FlowProgress step={step} status={stepStatus} labels={labels} />}
      {title && <h1 className="text-title [text-wrap:balance]">{title}</h1>}
    </div>
  );
}

function FlowProgress({ step, status, labels }: { step: 1 | 2 | 3; status?: StepStatus; labels: Labels }) {
  return (
    <ol aria-label="Progress" className="flex flex-wrap items-center gap-2 text-xs font-medium">
      {labels.map((label, index) => {
        const n = index + 1;
        const current = n === step;
        const done = n < step || (current && status === "done");
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className={cx("h-px w-5 sm:w-8", done || current ? "bg-accent" : "bg-line")} />}
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full",
                done && "bg-accent text-onAccent",
                current && !done && status === "failed" && "bg-danger text-canvas",
                current && !done && status === "unconfirmed" && "border-2 border-warning-ink text-warning-ink",
                current && !done && (status === undefined || status === "pending") && "border-2 border-accent text-accent",
                !done && !current && "border border-line text-muted",
              )}
            >
              <StepGlyph n={n} done={done} status={current ? status : undefined} />
            </span>
            <span className={current ? "text-ink" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StepGlyph({ n, done, status }: { n: number; done: boolean; status?: StepStatus }) {
  if (done) return <Check aria-hidden className="h-3.5 w-3.5" />;
  if (status === "pending") return <LoaderCircle aria-hidden className="h-3.5 w-3.5 motion-safe:animate-spin" />;
  if (status === "failed") return <X aria-hidden className="h-3.5 w-3.5" />;
  if (status === "unconfirmed") return <Clock aria-hidden className="h-3.5 w-3.5" />;
  return <>{n}</>;
}
