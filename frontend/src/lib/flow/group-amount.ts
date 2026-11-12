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

export function stripGrouping(text: string): string {
  return text.replace(/,/g, "");
}
