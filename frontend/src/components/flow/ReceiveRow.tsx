import type { ReactNode } from "react";

// U11 §6.1: what the user gets, in a well box: the label, an xl figure, its token or pair icon, and the minimum.

export function ReceiveRow({
  label = "You receive",
  value,
  minimum,
  icon,
}: {
  label?: ReactNode;
  value: ReactNode;
  minimum?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-inset bg-well px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 break-words text-xl font-medium">{value}</p>
        {minimum && <p className="mt-0.5 text-sm text-muted">{minimum}</p>}
      </div>
      {icon}
    </div>
  );
}
