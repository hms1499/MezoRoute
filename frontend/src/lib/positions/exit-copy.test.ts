import { describe, expect, it } from "vitest";
import { exitCopy } from "./exit-copy";

describe("exitCopy", () => {
  it("says one transaction when nothing is staked", () => {
    expect(exitCopy(0n).exitDetail).toMatch(/^One transaction/);
    expect(exitCopy(0n).unstakeNote).toBeNull();
  });

  it("says two transactions only when unstaking is needed", () => {
    expect(exitCopy(5n).exitDetail).not.toMatch(/^One transaction/);
    expect(exitCopy(5n).unstakeNote).toMatch(/two transactions/i);
  });

  it("notes that pending MEZO stays claimable and that fees go to veBTC voters", () => {
    expect(exitCopy(5n).unstakeNote).toMatch(/pending MEZO stays claimable/i);
    expect(exitCopy(5n).unstakeNote).toMatch(/veBTC voters/);
  });
});
