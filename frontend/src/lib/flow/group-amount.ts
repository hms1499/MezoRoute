// U18: the amount field shows well-formed digits grouped while it is not being edited. Display only: the URL, the
// parsed amount, and Max always carry ungrouped digits. Anything else (malformed text) shows exactly as typed.

const WELL_FORMED = /^\d+(\.\d*)?$/;

export function groupAmount(text: string): string {
  if (!WELL_FORMED.test(text)) return text;
  const dot = text.indexOf(".");
  const whole = dot === -1 ? text : text.slice(0, dot);
  const rest = dot === -1 ? "" : text.slice(dot);
  return whole.replace(/\B(?=(\d{3})+$)/g, ",") + rest;
}

const GROUPED = /^\d{1,3}(,\d{3})+(\.\d*)?$/;

/**
 * Commas go only when the whole text is well-formed thousands grouping ("1,000", "12,345.67"). Anything else passes
 * through, so a decimal comma ("0,5", typed on a comma-decimal keyboard) stays a field error and never becomes 5.
 */
export function stripGrouping(text: string): string {
  return GROUPED.test(text) ? text.replace(/,/g, "") : text;
}
