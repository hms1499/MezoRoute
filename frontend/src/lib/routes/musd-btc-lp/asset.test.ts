import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { ENTER_BTC_GAS, ENTER_BTC_STAKE_GAS } from "@/lib/quote/gas";
import { btcGasReserve, btcRecoveries, maxBtcSpendable, parseEntryAsset, spendableCap } from "./asset";

describe("maxBtcSpendable", () => {
  it("leaves the gas reserve in the wallet", () => {
    expect(maxBtcSpendable(100n, 30n)).toBe(70n);
    expect(maxBtcSpendable(30n, 30n)).toBe(0n);
  });

  it("is 0 when the reserve is above the balance", () => {
    expect(maxBtcSpendable(20n, 30n)).toBe(0n);
  });
});

describe("btcGasReserve", () => {
  it("is four times the entry's gas units at the current gas price (Ruling P17)", () => {
    expect(btcGasReserve(450_000n, 146n)).toBe(450_000n * 4n * 146n);
  });

  it("covers MetaMask's limit of 3 x the highest healthy estimate, for every BTC entry budget", () => {
    // Highest healthy estimates on testnet (5 Nov 2026): 439,723 unstaked, 497,277 staked. A wallet needs
    // balance >= limit x price, and MetaMask on Mezo mainnet sets the limit to 3 x the estimate.
    expect(btcGasReserve(ENTER_BTC_GAS, 1n)).toBeGreaterThanOrEqual(3n * 439_723n);
    expect(btcGasReserve(ENTER_BTC_STAKE_GAS, 1n)).toBeGreaterThanOrEqual(3n * 497_277n);
  });
});

describe("spendableCap", () => {
  it("is the balance less the reserve, limited by the cap", () => {
    expect(spendableCap(100n, 30n, 50n)).toBe(50n);
    expect(spendableCap(100n, 30n, 500n)).toBe(70n);
    expect(spendableCap(20n, 30n, 500n)).toBe(0n);
  });
});

describe("parseEntryAsset", () => {
  it("reads asset=btc, anything else is MUSD", () => {
    expect(parseEntryAsset("btc", "deposit")).toBe("btc");
    expect(parseEntryAsset(null, "deposit")).toBe("musd");
    expect(parseEntryAsset("eth", "deposit")).toBe("musd");
  });

  it("hides the BTC asset in borrow mode", () => {
    expect(parseEntryAsset("btc", "borrow")).toBe("musd");
  });
});

describe("btcRecoveries", () => {
  const input = { amount: 10n, walletBtc: 100n, reserve: 30n, cap: 500n, network: networks.testnet };

  it("offers the spendable balance", () => {
    expect(btcRecoveries(input)).toEqual([{ kind: "use-balance", amount: 70n }]);
  });

  it("marks an amount held back by the cap", () => {
    expect(btcRecoveries({ ...input, cap: 50n })).toEqual([{ kind: "use-balance", amount: 50n, capped: true }]);
  });

  it("points to the faucet when nothing is spendable", () => {
    expect(btcRecoveries({ ...input, walletBtc: 20n })).toEqual([{ kind: "get-btc", href: networks.testnet.faucetUrl }]);
  });

  it("points to the Mezo app on mainnet", () => {
    expect(btcRecoveries({ ...input, walletBtc: 0n, network: networks.mainnet })).toEqual([
      { kind: "get-btc", href: networks.mainnet.mezoAppUrl },
    ]);
  });
});
