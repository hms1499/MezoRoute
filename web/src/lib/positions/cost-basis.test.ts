import { describe, expect, it } from "vitest";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";
import { costBasis } from "./cost-basis";
import type { HistoryEvent } from "./history";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const ONE = 10n ** 18n;

function entered(overrides: Partial<EnteredEvent> = {}, blockNumber = 1n): HistoryEvent {
  return {
    kind: "entered",
    blockNumber,
    logIndex: 0,
    event: {
      caller: ME,
      recipient: ME,
      musdBorrowed: 0n,
      musdIn: 100n * ONE,
      fee: ONE / 10n,
      musdSwapped: 50n * ONE,
      btcFromSwap: 1_000n,
      musdAdded: 49n * ONE,
      btcAdded: 1_000n,
      liquidityOut: 1_000n,
      musdRefund: 0n,
      btcRefund: 0n,
      ...overrides,
    },
  };
}

function exited(liquidityIn: bigint, blockNumber = 2n): HistoryEvent {
  const event: ExitedEvent = {
    caller: ME,
    recipient: ME,
    liquidityIn,
    musdRemoved: 0n,
    btcRemoved: 0n,
    musdFromSwap: 0n,
    musdOut: 0n,
    btcRefund: 0n,
  };
  return { kind: "exited", blockNumber, logIndex: 0, event };
}

describe("costBasis", () => {
  it("is MUSD in minus refunds, with the MezoRoute fee inside it", () => {
    expect(costBasis([entered({ musdRefund: 2n * ONE })], 1_000n)).toEqual({
      attributedLp: 1_000n,
      basis: 98n * ONE,
      coveredLp: 1_000n,
      coveredBasis: 98n * ONE,
      coveredFees: ONE / 10n,
      unattributedLp: 0n,
    });
  });

  it("values a BTC refund at the entry's swap price", () => {
    // 10 wei BTC at 50 MUSD per 1,000 wei = 0.5 MUSD
    expect(costBasis([entered({ btcRefund: 10n })], 1_000n).basis).toBe(99n * ONE + ONE / 2n);
  });

  it("removes cost pro rata by LP on a partial exit, and all of it on a full exit", () => {
    expect(costBasis([entered(), exited(250n)], 750n)).toMatchObject({
      attributedLp: 750n,
      basis: 75n * ONE,
      coveredFees: (ONE / 10n) * 3n / 4n,
    });
    expect(costBasis([entered(), exited(1_000n)], 0n)).toMatchObject({ attributedLp: 0n, basis: 0n, coveredBasis: 0n });
  });

  it("never goes below zero when more LP exits than MezoRoute entered", () => {
    expect(costBasis([entered(), exited(5_000n)], 0n)).toMatchObject({ attributedLp: 0n, basis: 0n });
  });

  it("leaves LP from elsewhere without a cost basis", () => {
    expect(costBasis([entered()], 1_500n)).toMatchObject({ coveredLp: 1_000n, coveredBasis: 100n * ONE, unattributedLp: 500n });
    expect(costBasis([], 1_500n)).toMatchObject({ coveredLp: 0n, coveredBasis: 0n, unattributedLp: 1_500n });
  });

  it("scales the basis down when the wallet holds less LP than MezoRoute entered", () => {
    expect(costBasis([entered()], 400n)).toMatchObject({ coveredLp: 400n, coveredBasis: 40n * ONE, unattributedLp: 0n });
  });
});
