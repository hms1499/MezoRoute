import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { quoteClose } from "./quote-close";
import { quoteUnwind } from "./quote-unwind";
import type { TroveSnapshot } from "./snapshot";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";
import { costText, crPresets, leverageMaxNote, maxTargetText, openMaxNote, pageNotice, openBtcMax, openReachNote, presetsWithin, refinanceNote, troveOverviewRows, unwindMaxNote, unwindReachNote } from "./view";

const t = trove(ONE, 40_000n * ONE);
const snapshot: TroveSnapshot = {
  trove: t,
  troveStatus: 1,
  pool: HARNESS_POOL,
  market: HARNESS_MARKET,
  system: { coll: 1_000n * ONE, debt: 20_000_000n * ONE, ccr: (15n * ONE) / 10n, troveCount: 10n },
  recoveryMode: false,
  bosNonce: 0n,
  musdPermitNonce: 0n,
  btcPermitNonce: 0n,
  walletMusd: 500n * ONE,
  walletBtc: ONE,
  surplusBtc: 0n,
  block: { number: 1n, timestamp: 1n },
};

describe("costText", () => {
  it("reads a cost as worse than the oracle and a gain as better", () => {
    expect(costText(369n)).toBe("3.69% above Mezo's oracle price");
    expect(costText(-60n)).toBe("0.6% better than Mezo's oracle price"); // formatBps trims trailing zeros
    expect(costText(0n)).toBe("At Mezo's oracle price");
  });
});

describe("troveOverviewRows", () => {
  it("leads an Unwind with the cost, then the Trove before → after", () => {
    const q = quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, 3n * ONE, 100n)!;
    const rows = troveOverviewRows({ action: "unwind", quote: q }, snapshot);
    expect(rows.map((r) => r.label)).toEqual(["Cost against the oracle", "Debt repaid", "BTC sold", "BTC to your wallet", "Collateral", "Debt", "Collateral ratio", "Liquidation price"]);
    expect(String(rows[6].value)).toContain("→");
  });

  it("leads a Close with the BTC to the wallet after the cost", () => {
    const rows = troveOverviewRows({ action: "close", quote: quoteClose(t, HARNESS_POOL, HARNESS_MARKET, 100n) }, snapshot);
    expect(rows.slice(0, 2).map((r) => r.label)).toEqual(["Cost against the oracle", "BTC to your wallet"]);
  });
});

describe("crPresets", () => {
  it("offers targets above today's CR for Unwind and below it, never under 200%, for Leverage", () => {
    expect(crPresets("unwind", (25n * ONE) / 10n)).toEqual([3n * ONE, (35n * ONE) / 10n, 4n * ONE]);
    expect(crPresets("leverage", (25n * ONE) / 10n)).toEqual([2n * ONE, (225n * ONE) / 100n]);
    expect(crPresets("leverage", (19n * ONE) / 10n)).toEqual([]);
  });
});

describe("pageNotice", () => {
  it("shows Recovery Mode with Repay from wallet when the wallet holds MUSD", () => {
    const n = pageNotice({ action: "unwind", snapshot: { ...snapshot, recoveryMode: true }, network: networks.testnet, block: "recovery-mode" })!;
    expect(n.tone).toBe("warning");
    expect(n.actions).toEqual(["repay", "open-app"]);
  });

  it("names the EVM-only rule for Bitcoin wallets and offers Close beyond the Unwind maximum", () => {
    expect(pageNotice({ action: "close", snapshot, network: networks.testnet, block: "smart-account" })?.text).toContain("EVM wallet");
    expect(pageNotice({ action: "unwind", snapshot, network: networks.testnet, block: "below-min-debt" })?.actions).toEqual(["close-instead"]);
  });

  it("flags mainnet as not yet run end to end when nothing blocks", () => {
    expect(pageNotice({ action: "leverage", snapshot, network: networks.mainnet, block: null })?.text).toBe("Not yet run end to end on mainnet.");
    expect(pageNotice({ action: "leverage", snapshot, network: networks.testnet, block: null })).toBeNull();
  });
});

describe("leverageMaxNote", () => {
  it("says what stops the largest Leverage", () => {
    expect(leverageMaxNote({ btc: ONE / 10n, limitedBy: "floor" }, 2n * ONE)).toBe("Up to 0.1 BTC: the most that keeps your Trove at 200% (the 200% floor).");
    expect(leverageMaxNote({ btc: ONE / 100n, limitedBy: "cap" }, 2n * ONE)).toContain("MezoRoute's per-transaction cap");
    expect(leverageMaxNote({ btc: ONE / 100n, limitedBy: "capacity" }, 2n * ONE)).toContain("borrowing capacity, even after a refinance");
    expect(leverageMaxNote({ btc: ONE / 100n, limitedBy: "oracle" }, 2n * ONE)).toContain("5% from Mezo's oracle");
    expect(leverageMaxNote({ btc: 0n, limitedBy: "floor" }, 2n * ONE)).toBe("Your Trove is already at or below 200%: there is no room to leverage.");
  });
});

describe("refinanceNote", () => {
  it("explains the extra step only when the plan has it", () => {
    expect(refinanceNote("refinance")).toContain("Refinance first");
    expect(refinanceNote("ok")).toBeNull();
    expect(refinanceNote("blocked")).toBeNull();
  });
});

describe("unwindReachNote", () => {
  it("tells the user when the target is out of an Unwind's reach and offers Close", () => {
    expect(unwindReachNote({ current: (25n * ONE) / 10n, maxCr: (355n * ONE) / 100n, target: 4n * ONE })).toEqual({
      text: "An Unwind reaches at most 355% here: past that your debt would fall under the 1,800 MUSD minimum. Close the Trove instead.",
      closeInstead: true,
    });
    expect(unwindReachNote({ current: (25n * ONE) / 10n, maxCr: null, target: 3n * ONE })?.closeInstead).toBe(true);
    expect(unwindReachNote({ current: (25n * ONE) / 10n, maxCr: (355n * ONE) / 100n, target: 2n * ONE })).toEqual({
      text: "Choose a ratio above today's 250%.",
      closeInstead: false,
    });
    expect(unwindReachNote({ current: (25n * ONE) / 10n, maxCr: (355n * ONE) / 100n, target: 3n * ONE })).toBeNull();
    expect(unwindReachNote({ current: (25n * ONE) / 10n, maxCr: (355n * ONE) / 100n, target: null })).toBeNull();
  });
});

describe("openBtcMax", () => {
  it("keeps a gas reserve of budget × 4 at the gas price, and is unknown without a gas price", () => {
    expect(openBtcMax(ONE, 10n ** 9n, networks.testnet)).toBe(ONE - 895_000n * 4n * 10n ** 9n);
    expect(openBtcMax(ONE, 10n ** 9n, networks.mainnet)).toBe(ONE - ((895_000n * 13n) / 10n) * 4n * 10n ** 9n);
    expect(openBtcMax(ONE, undefined, networks.testnet)).toBeNull();
    expect(openBtcMax(1_000n, 10n ** 9n, networks.testnet)).toBe(0n);
  });
});

describe("openReachNote", () => {
  it("explains an unreachable Open with the most it reaches", () => {
    expect(openReachNote({ btc: ONE / 100n, cr: (25n * ONE) / 10n, maxTarget: (2364n * ONE) / 1000n, quoteFound: false })).toBe(
      "With 0.01 BTC, a new Trove reaches at most 236.4%. Choose that or less, or add BTC.",
    );
    expect(openReachNote({ btc: ONE / 100n, cr: 2n * ONE, maxTarget: (165n * ONE) / 100n, quoteFound: false })).toBe(
      "With 0.01 BTC, a new Trove reaches at most 165%, under the 200% floor: a Trove needs at least 1,800 MUSD of debt. Add BTC.",
    );
    // Under the floor there is nothing to choose, so it shows before a target is typed (every preset is dropped).
    expect(openReachNote({ btc: ONE / 100n, cr: null, maxTarget: (165n * ONE) / 100n, quoteFound: false })).toContain("under the 200% floor");
    expect(openReachNote({ btc: ONE / 100n, cr: null, maxTarget: (2364n * ONE) / 1000n, quoteFound: false })).toBeNull();
    expect(openReachNote({ btc: ONE, cr: 2n * ONE, maxTarget: 3n * ONE, quoteFound: true })).toBeNull();
    expect(openReachNote({ btc: null, cr: 2n * ONE, maxTarget: null, quoteFound: false })).toBeNull();
  });
});

describe("maxTargetText", () => {
  it("rounds the most reachable CR down to 0.1%, after the quote buffer when the action adds one", () => {
    expect(maxTargetText((24738n * ONE) / 10_000n, false)).toBe("247.3");
    expect(maxTargetText(2n * ONE, false)).toBe("200.0");
    // Open and Leverage quote 0.5% above the target: 241.2% / 1.005 = 240.0
    expect(maxTargetText((2412n * ONE) / 1000n, true)).toBe("240.0");
  });
});

describe("presetsWithin", () => {
  it("drops presets past the most an action reaches, and keeps them all while that is unknown", () => {
    const presets = [(25n * ONE) / 10n, 3n * ONE, (35n * ONE) / 10n];
    expect(presetsWithin(presets, (2473n * ONE) / 1000n)).toEqual([]);
    expect(presetsWithin(presets, 3n * ONE)).toEqual([(25n * ONE) / 10n, 3n * ONE]);
    expect(presetsWithin(presets, null)).toEqual(presets);
  });
});

describe("unwindMaxNote / openMaxNote", () => {
  it("names the most each action reaches", () => {
    expect(unwindMaxNote((2473n * ONE) / 1000n)).toBe("Up to 247.3%: past that your debt would fall under the 1,800 MUSD minimum.");
    expect(openMaxNote(ONE / 25n, (2364n * ONE) / 1000n)).toBe("With 0.04 BTC, up to 236.4%: past that the debt would fall under the 1,800 MUSD minimum.");
  });
});
