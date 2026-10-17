import type { ErrorKind } from "@/lib/errors/types";

export type ReceiptState = "pending" | "confirmed" | "failed" | "unconfirmed";

/**
 * The receipt page's status. A transaction whose receipt never arrived is "unconfirmed", not
 * "failed": it may still be mined, and showing a failure would invite sending it twice.
 */
export function receiptState(input: { isSuccess: boolean; errorKind: ErrorKind | null }): ReceiptState {
  if (input.isSuccess) return "confirmed";
  if (input.errorKind === null) return "pending";
  return input.errorKind === "unconfirmed" ? "unconfirmed" : "failed";
}
