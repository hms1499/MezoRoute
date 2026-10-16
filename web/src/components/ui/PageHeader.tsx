import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { cx } from "@/lib/ui/cx";

type Labels = readonly [string, string, string];
const DEFAULT_LABELS: Labels = ["Amount", "Confirm", "Done"];

/** Back link, flow progress (① ─ ② ─ ③), and the page title for route, confirm, and receipt pages. */
export function PageHeader({
  back,
  title,
  step,
  labels = DEFAULT_LABELS,
}: {
  back: { href: string; label: string };
  title?: string;
  step?: 1 | 2 | 3;
  labels?: Labels;
}) {
  return (
    <div className="space-y-3">
      <Link href={back.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full text-sm font-medium text-muted hover:text-accent">
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {back.label}
      </Link>
      {step && <FlowProgress step={step} labels={labels} />}
      {title && <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight [text-wrap:balance]">{title}</h1>}
    </div>
  );
}

function FlowProgress({ step, labels }: { step: 1 | 2 | 3; labels: Labels }) {
  return (
    <ol aria-label="Progress" className="flex flex-wrap items-center gap-2 text-xs font-medium">
      {labels.map((label, index) => {
        const n = index + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className={cx("h-px w-5 sm:w-8", done || current ? "bg-accent" : "bg-line")} />}
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full",
                done && "bg-accent text-onAccent",
                current && "border-2 border-accent text-accent",
                !done && !current && "border border-line text-muted",
              )}
            >
              {done ? <Check aria-hidden className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={current ? "text-ink" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
