import { describe, expect, it } from "vitest";
import { revertStringOutcome } from "./revert-strings";

describe("revertStringOutcome: BorrowerOperations and its signatures (F4)", () => {
  it.each([
    ["BorrowerOperationsSignatures: Invalid signature", "signature-invalid"],
    ["Signature expired", "permit-expired"],
    ["BorrowerOps: An operation that would result in ICR < MCR is not permitted", "cr-floor"],
    ["BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted", "above-headroom"],
    ["BorrowerOps: An operation that would result in TCR < CCR is not permitted", "recovery-mode"],
    ["BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode", "recovery-mode"],
    ["BorrowerOps: Trove does not exist or is closed", "no-trove"],
  ])("maps %j", (reason, kind) => {
    expect(revertStringOutcome(reason)?.kind).toBe(kind);
  });

  it("keeps the F1 rows", () => {
    expect(revertStringOutcome("ERC20: insufficient allowance")?.kind).toBe("allowance");
  });
});
