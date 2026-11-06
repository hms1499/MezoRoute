"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §5.6: the app's one segmented control. A well track; the selected item is a surface chip with a line ring, the
// others muted text. Radio semantics for a choice, tab semantics for the mobile Compare tabs; arrow keys move the
// selection (and wrap), and only the selected item sits in the tab order.

export type SegmentedSize = "md" | "sm";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** An element that explains the item (the Borrow & Deploy note). */
  describedBy?: string;
  /** Tabs only: the item's id and the panel it controls. */
  id?: string;
  controls?: string;
};

const ITEM: Record<SegmentedSize, string> = { md: "min-h-9 px-4 text-sm", sm: "min-h-7 px-3 text-xs" };

/** One item's classes; the header nav uses it on its links so the header shows one selected style. */
export function segmentedItemClass(selected: boolean, size: SegmentedSize): string {
  return cx(
    "hit inline-flex items-center justify-center rounded-pill font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    ITEM[size],
    selected ? "bg-surface text-ink ring-1 ring-line" : "text-muted hover:text-ink",
  );
}

/** The track's classes: a well pill around the items. */
export function segmentedTrackClass(size: SegmentedSize, fill = false): string {
  return cx(fill ? "flex" : "inline-flex", "gap-1 rounded-pill bg-well", size === "sm" ? "p-0.5" : "p-1");
}

/** Which value a key moves the selection to (arrows wrap and skip disabled items); null for any other key. */
export function segmentedKey<T extends string>(key: string, current: T, values: readonly T[], disabled: readonly T[]): T | null {
  const enabled = values.filter((value) => !disabled.includes(value));
  if (enabled.length === 0) return null;
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (step === 0) return null;
  let index = values.indexOf(current);
  for (let i = 0; i < values.length; i++) {
    index = (index + step + values.length) % values.length;
    if (!disabled.includes(values[index])) return values[index];
  }
  return null;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  semantics = "radio",
  fill = false,
  className,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedSize;
  semantics?: "radio" | "tabs";
  /** Stretch the track and its items to the container's width (the mobile Compare tabs). */
  fill?: boolean;
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const tabs = semantics === "tabs";

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = segmentedKey(
      event.key,
      value,
      options.map((option) => option.value),
      options.filter((option) => option.disabled).map((option) => option.value),
    );
    if (next === null) return;
    event.preventDefault();
    if (next !== value) onChange(next);
    refs.current.get(next)?.focus();
  }

  return (
    <div role={tabs ? "tablist" : "radiogroup"} aria-label={label} className={cx(segmentedTrackClass(size, fill), className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role={tabs ? "tab" : "radio"}
            id={option.id}
            aria-controls={option.controls}
            aria-checked={tabs ? undefined : selected}
            aria-selected={tabs ? selected : undefined}
            aria-describedby={option.describedBy}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => selected || onChange(option.value)}
            onKeyDown={onKeyDown}
            className={cx(segmentedItemClass(selected, size), fill && "flex-1")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
