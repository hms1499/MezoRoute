import { describe, expect, it } from "vitest";
import { receiptState } from "./receipt-state";

describe("receiptState", () => {
  it("is pending until the receipt query settles, then confirmed", () => {
    expect(receiptState({ isSuccess: false, errorKind: null })).toBe("pending");
    expect(receiptState({ isSuccess: true, errorKind: null })).toBe("confirmed");
  });

  it("keeps an unconfirmed transaction apart from a failed one, so nobody sends twice", () => {
    expect(receiptState({ isSuccess: false, errorKind: "unconfirmed" })).toBe("unconfirmed");
    expect(receiptState({ isSuccess: false, errorKind: "slippage" })).toBe("failed");
  });
});
