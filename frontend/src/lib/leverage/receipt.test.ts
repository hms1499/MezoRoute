import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { LIVE_CLOSED_LOG, LIVE_LEVERAGED_LOG, LIVE_OPENED_LOG, LIVE_UNWOUND_LOG } from "./live-logs";
import { findTroveReceipt, troveReceiptRows } from "./receipt";

const testnet = networks.testnet;
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

describe("findTroveReceipt (live smoke receipts)", () => {
  it("decodes Unwound", () => {
    const r = findTroveReceipt([LIVE_UNWOUND_LOG], testnet)!;
    expect(r.kind).toBe("unwound");
    expect(r.borrower).toBe(ME);
    expect(r.kind === "unwound" && r.debtRepaid).toBe(50n * 10n ** 18n);
  });

  it("decodes Leveraged, Closed and OpenedLeveraged", () => {
    expect(findTroveReceipt([LIVE_LEVERAGED_LOG], testnet)?.kind).toBe("leveraged");
    expect(findTroveReceipt([LIVE_CLOSED_LOG], testnet)?.kind).toBe("closed");
    const open = findTroveReceipt([LIVE_OPENED_LOG], testnet)!;
    expect(open.kind === "opened" && open.btcFromUser).toBe(35_000_000_000_000_000n);
  });

  it("ignores logs from any other address", () => {
    expect(findTroveReceipt([{ ...LIVE_UNWOUND_LOG, address: testnet.addresses.pool }], testnet)).toBeNull();
  });
});

describe("troveReceiptRows", () => {
  it("shows what an Unwind did", () => {
    const rows = troveReceiptRows(findTroveReceipt([LIVE_UNWOUND_LOG], testnet)!);
    expect(rows.map((r) => r.label)).toEqual(["Debt repaid", "BTC withdrawn", "BTC sold to the pool", "BTC to your wallet"]);
    expect(rows[0].value).toBe("50 MUSD"); // formatToken, as every receipt row
  });

  it("shows what a Close, a Leverage and an Open did", () => {
    expect(troveReceiptRows(findTroveReceipt([LIVE_CLOSED_LOG], testnet)!).map((r) => r.label)).toEqual(["Debt repaid", "BTC sold to the pool", "BTC to your wallet"]);
    expect(troveReceiptRows(findTroveReceipt([LIVE_LEVERAGED_LOG], testnet)!).map((r) => r.label)).toEqual(["BTC added", "MUSD borrowed", "Paid to the pool", "MezoRoute fee", "MUSD to your wallet"]);
    expect(troveReceiptRows(findTroveReceipt([LIVE_OPENED_LOG], testnet)!).map((r) => r.label)).toEqual(["BTC from your wallet", "BTC added from the pool", "MUSD borrowed", "Paid to the pool", "MezoRoute fee", "MUSD to your wallet"]);
  });
});
