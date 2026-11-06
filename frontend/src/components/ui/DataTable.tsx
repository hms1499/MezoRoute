import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §5.6: the one table style. Header 12/500 muted, left for the first column and right for figures; rows 14/400
// with 12 px vertical padding (12/400 and 8 px in a dense side-panel table); a line divider; no zebra striping.

type Align = "left" | "right";

export function tableClass(dense = false): string {
  return cx("w-full border-collapse", dense ? "text-xs" : "text-sm");
}

/** A column header: 12/500 muted with 8 px vertical padding in both densities. `dense` is accepted for symmetry. */
export function thClass(align: Align, _dense = false): string {
  return cx("border-b border-line py-2 text-xs font-medium text-muted", align === "right" ? "text-right" : "text-left");
}

/** A row header (`th scope="row"`): body weight, left-aligned. */
export function rowThClass(dense = false): string {
  return cx("text-left font-normal", dense ? "py-2" : "py-3");
}

export function tdClass(align: Align, dense = false): string {
  return cx(dense ? "py-2" : "py-3", align === "right" ? "text-right" : "text-left");
}

/** A body row: the divider between rows. */
export const trClass = "border-b border-line last:border-b-0";

/** A column: its header, alignment, and cell. `action` marks the row's action, which is full width in the card list. */
export type DataColumn<R> = { key: string; header: ReactNode; align: Align; cell: (row: R) => ReactNode; action?: boolean };

/**
 * U11 §6.1: the responsive table. From 768 px a `<table>` with a visually hidden caption; below 768 px a list of cards
 * (the first column as the card's title, the others as label/value pairs, the action full width). With no rows, one
 * neutral row holds `empty`.
 */
export function DataTable<R>({
  caption,
  columns,
  rows,
  empty,
  rowKey = (_row, index) => String(index),
}: {
  caption: string;
  columns: DataColumn<R>[];
  rows: R[];
  empty: ReactNode;
  rowKey?: (row: R, index: number) => string;
}) {
  const [first, ...rest] = columns;
  const pairs = rest.filter((column) => !column.action);
  const actions = rest.filter((column) => column.action);
  return (
    <>
      <table className={cx(tableClass(), "hidden md:table")}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={thClass(column.align)}>
                {column.action && !column.header ? <span className="sr-only">Action</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className={trClass}>
              <td colSpan={columns.length} className={cx(tdClass("left"), "text-muted")}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className={trClass}>
                {columns.map((column, at) =>
                  at === 0 ? (
                    <th key={column.key} scope="row" className={cx(rowThClass(), "font-normal")}>
                      {column.cell(row)}
                    </th>
                  ) : (
                    <td key={column.key} className={cx(tdClass(column.align), column.action && "pl-3")}>
                      {column.cell(row)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="text-sm text-muted md:hidden">{empty}</p>
      ) : (
        <ul aria-label={caption} className="space-y-3 md:hidden">
          {rows.map((row, index) => (
            <li key={rowKey(row, index)} className="space-y-3 rounded-inset border border-line p-4">
              <div className="text-sm">{first.cell(row)}</div>
              {pairs.length > 0 && (
                <dl className="space-y-2 text-sm">
                  {pairs.map((column) => (
                    <div key={column.key} className="flex items-start justify-between gap-3">
                      <dt className="text-xs font-medium text-muted">{column.header}</dt>
                      <dd className="text-right">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {actions.map((column) => (
                <div key={column.key} className="grid [&>*]:w-full">
                  {column.cell(row)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
