import { describe, expect, it } from "vitest";
import { exitCopy } from "./exit-copy";

describe("exitCopy", () => {
  it("says one transaction when nothing is staked", () => {
    for (const steps of [["exit"], ["permit", "exit"], ["approve", "exit"]] as const) {
      expect(exitCopy(steps).exitDetail).toMatch(/^One transaction/);
      expect(exitCopy(steps).unstakeNote).toBeNull();
    }
  });

  it("says two transactions for a standard wallet: the permit is a signature", () => {
    expect(exitCopy(["unstake", "permit", "exit"]).exitDetail).not.toMatch(/^One transaction/);
    expect(exitCopy(["unstake", "permit", "exit"]).unstakeNote).toMatch(/two transactions: unstake, then exit/i);
  });

  it("says three transactions for a Bitcoin wallet with a short allowance", () => {
    expect(exitCopy(["unstake", "approve", "exit"]).unstakeNote).toMatch(/three transactions: unstake, approve, then exit/i);
  });

  it("says two transactions when a Bitcoin wallet's allowance already covers the exit", () => {
    expect(exitCopy(["unstake", "exit"]).unstakeNote).toMatch(/two transactions: unstake, then exit/i);
  });

  it("notes that pending MEZO stays claimable and that fees go to veBTC voters", () => {
    expect(exitCopy(["unstake", "exit"]).unstakeNote).toMatch(/pending MEZO stays claimable/i);
    expect(exitCopy(["unstake", "exit"]).unstakeNote).toMatch(/veBTC voters/);
  });
});
