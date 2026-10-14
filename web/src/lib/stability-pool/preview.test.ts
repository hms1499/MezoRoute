import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { APPROVE_GAS, RELAYED_CALL_GAS, SP_DEPOSIT_GAS, SP_WITHDRAW_GAS } from "@/lib/quote/gas";
import { spClaimPreview, spDepositPreview, spWithdrawPreview } from "./preview";
import { spDataWith, spSnapshotWith } from "./test-fixtures";

const withDeposit = spDataWith({
  snapshot: spSnapshotWith({
    dashboard: snapshotWith({ musd: 500n * ONE, sp: { deposit: 40n * ONE, btcGain: 3n } }),
    initialDeposit: 50n * ONE,
  }),
});
const base = { network: networks.testnet, walletChainId: 31611 };

describe("spDepositPreview", () => {
  it("approves, then deposits; the pending gain is paid out and the exposure moves into the pool", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: 10n * ONE, walletKind: "eoa" });
    expect(preview.steps).toEqual(["approve", "deposit"]);
    expect(preview).toMatchObject({ depositNow: 40n * ONE, gainPaid: 3n, depositAfter: 50n * ONE, block: null });
    expect(preview.after?.musd).toBe(490n * ONE);
    expect(preview.after?.sp).toEqual({ deposit: 50n * ONE, btcGain: 0n });
    expect(preview.gasCost).toBe((APPROVE_GAS + SP_DEPOSIT_GAS) * 146n);
  });

  it("skips the approval when the allowance covers the amount", () => {
    const data = spDataWith({ snapshot: spSnapshotWith({ allowance: 10n * ONE }) });
    expect(spDepositPreview({ ...base, data, musdIn: 10n * ONE, walletKind: "eoa" }).steps).toEqual(["deposit"]);
  });

  it("adds the relayer's gas for a Bitcoin wallet", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: 10n * ONE, walletKind: "smart-account" });
    expect(preview.gasCost).toBe((APPROVE_GAS + SP_DEPOSIT_GAS + 2n * RELAYED_CALL_GAS) * 146n);
  });

  it("has no outcome and no after-state without an amount", () => {
    const preview = spDepositPreview({ ...base, data: withDeposit, musdIn: null, walletKind: "eoa" });
    expect(preview).toMatchObject({ after: null, depositAfter: null, block: { reason: "zero" } });
  });
});

describe("spWithdrawPreview", () => {
  it("withdraws the exact compounded deposit at Max", () => {
    const preview = spWithdrawPreview({ ...base, data: withDeposit, percent: 100, walletKind: "eoa" });
    expect(preview).toMatchObject({ amount: 40n * ONE, depositAfter: 0n, gainPaid: 3n, block: null });
    expect(preview.gasCost).toBe(SP_WITHDRAW_GAS * 146n);
  });

  it("rounds a share down", () => {
    const data = spDataWith({
      snapshot: spSnapshotWith({ dashboard: snapshotWith({ sp: { deposit: 3n, btcGain: 0n } }), initialDeposit: 3n }),
    });
    expect(spWithdrawPreview({ ...base, data, percent: 25, walletKind: "eoa" }).amount).toBe(0n);
  });

  it("blocks without a deposit", () => {
    expect(spWithdrawPreview({ ...base, data: spDataWith(), percent: 100, walletKind: "eoa" }).block?.reason).toBe("no-deposit");
  });
});

describe("spClaimPreview", () => {
  it("allows a claim with a pending gain and blocks one without", () => {
    expect(spClaimPreview({ ...base, data: withDeposit })).toBeNull();
    expect(spClaimPreview({ ...base, data: spDataWith() })?.reason).toBe("no-deposit");
  });
});
