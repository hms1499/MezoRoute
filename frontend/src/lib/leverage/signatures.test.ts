import { recoverTypedDataAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { LIVE_CLOSE, LIVE_LEVERAGE, LIVE_OPEN, LIVE_SIGNER, LIVE_UNWIND } from "./live-signatures";
import { adjustTypedData, closeTypedData, openTypedData } from "./signatures";

const network = networks.testnet;

describe("Trove authorisations recover the live testnet signatures", () => {
  it("AdjustTrove (unwind)", async () => {
    const m = LIVE_UNWIND.message;
    const data = adjustTypedData({ network, borrower: m.borrower, collWithdrawal: m.collWithdrawal, debtChange: m.debtChange, isDebtIncrease: m.isDebtIncrease, assetAmount: m.assetAmount, nonce: m.nonce, deadline: m.deadline });
    expect(await recoverTypedDataAddress({ ...data, signature: LIVE_UNWIND.signature })).toBe(LIVE_SIGNER);
  });

  it("AdjustTrove (leverage, binding the BTC sent)", async () => {
    const m = LIVE_LEVERAGE.message;
    const data = adjustTypedData({ network, borrower: m.borrower, collWithdrawal: m.collWithdrawal, debtChange: m.debtChange, isDebtIncrease: m.isDebtIncrease, assetAmount: m.assetAmount, nonce: m.nonce, deadline: m.deadline });
    expect(await recoverTypedDataAddress({ ...data, signature: LIVE_LEVERAGE.signature })).toBe(LIVE_SIGNER);
  });

  it("CloseTrove", async () => {
    const m = LIVE_CLOSE.message;
    const data = closeTypedData({ network, borrower: m.borrower, nonce: m.nonce, deadline: m.deadline });
    expect(await recoverTypedDataAddress({ ...data, signature: LIVE_CLOSE.signature })).toBe(LIVE_SIGNER);
  });

  it("OpenTrove", async () => {
    const m = LIVE_OPEN.message;
    const data = openTypedData({ network, borrower: m.borrower, assetAmount: m.assetAmount, debtAmount: m.debtAmount, nonce: m.nonce, deadline: m.deadline });
    expect(await recoverTypedDataAddress({ ...data, signature: LIVE_OPEN.signature })).toBe(LIVE_SIGNER);
  });

  it("always names the borrower as recipient", () => {
    const data = closeTypedData({ network, borrower: LIVE_SIGNER, nonce: 0n, deadline: 0n });
    expect(data.message.recipient).toBe(LIVE_SIGNER);
  });
});
