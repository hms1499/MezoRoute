import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { balanceRecoveries } from "./balance-recovery";

const ROOM = 4_799n * (WAD / 10n); // 479.9 MUSD
const base = {
  route: "lp" as const,
  amount: 500n * WAD,
  walletMusd: 0n,
  canBorrowAndDeploy: true,
  borrowLimit: ROOM,
  recoveryMode: false,
  mezoAppUrl: "https://testnet.mezo.org",
};

describe("balanceRecoveries", () => {
  it("offers Borrow & Deploy for the most the Trove can borrow", () => {
    expect(balanceRecoveries(base)).toEqual([{ kind: "borrow-instead", amount: ROOM }]);
  });

  it("borrows only the typed amount when the room covers it", () => {
    expect(balanceRecoveries({ ...base, amount: 100n * WAD })).toEqual([{ kind: "borrow-instead", amount: 100n * WAD }]);
  });

  it("adds the wallet balance after borrowing", () => {
    expect(balanceRecoveries({ ...base, walletMusd: 20n * WAD })).toEqual([
      { kind: "borrow-instead", amount: ROOM },
      { kind: "use-balance", amount: 20n * WAD },
    ]);
  });

  it("sends a smart account with no MUSD to the Mezo app", () => {
    expect(balanceRecoveries({ ...base, canBorrowAndDeploy: false })).toEqual([{ kind: "get-musd", href: "https://testnet.mezo.org" }]);
  });

  it("never offers borrowing in recovery mode, on the Stability Pool, or below 1 MUSD of room", () => {
    for (const input of [{ ...base, recoveryMode: true }, { ...base, route: "sp" as const }, { ...base, borrowLimit: WAD - 1n }]) {
      expect(balanceRecoveries(input).map((a) => a.kind)).toEqual(["get-musd"]);
    }
  });

  it("offers the wallet balance alone when borrowing is out", () => {
    expect(balanceRecoveries({ ...base, route: "sp", walletMusd: 5n * WAD })).toEqual([{ kind: "use-balance", amount: 5n * WAD }]);
  });
});
