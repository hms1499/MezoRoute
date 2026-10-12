import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { NOTHING_TO_CLAIM } from "@/lib/errors/outcomes";
import { BlockedError } from "@/lib/tx/errors";
import { assertClaimable, claimBlock, claimRows, findClaimEvent } from "./claim";

const testnet = networks.testnet;
const fees = { musd: 1n, btc: 0n };

describe("claimBlock", () => {
  it("lets a claim through with fees, the right network, and gas", () => {
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: false })).toBeNull();
  });

  it("blocks in order: no executor (mainnet read-only), wrong network, nothing to claim, gas", () => {
    expect(claimBlock({ network: networks.mainnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("no-executor");
    expect(claimBlock({ network: testnet, walletChainId: 1, fees: { musd: 0n, btc: 0n }, lacksGas: true })?.reason).toBe("wrong-network");
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees: { musd: 0n, btc: 0n }, lacksGas: true })).toMatchObject({
      reason: "nothing-to-claim",
      outcome: { message: "You have no fees to claim yet." },
    });
    expect(claimBlock({ network: testnet, walletChainId: testnet.chainId, fees, lacksGas: true })?.reason).toBe("needs-gas");
  });
});

// A live claim on the testnet pool, tx 0xa2e6e1a0…cdf05 (block 16043462), by 0x50A2…63fe.
const claimLog = {
  address: "0xd16a5df82120ed8d626a1a15232bfce2366d6aa9",
  topics: [
    "0x865ca08d59f5cb456e85cd2f7ef63664ea4f73327414e9d8152c4158b0e94645",
    "0x00000000000000000000000050a20e21c2be8f86746bfb8233854ad3569863fe",
    "0x00000000000000000000000050a20e21c2be8f86746bfb8233854ad3569863fe",
  ],
  data: "0x000000000000000000000000000000000000000000000000056e26faeb77855000000000000000000000000000000000000000000000000000000510050ecba8",
} as const;

describe("findClaimEvent", () => {
  it("decodes the live Claim with token0 as MUSD on testnet", () => {
    expect(findClaimEvent([claimLog], testnet)).toEqual({ musd: 391293076761970000n, btc: 5566362471336n });
  });

  it("maps amount0 to BTC on mainnet", () => {
    const mainnetLog = { ...claimLog, address: networks.mainnet.addresses.pool.toLowerCase() as `0x${string}` };
    expect(findClaimEvent([mainnetLog], networks.mainnet)).toEqual({ musd: 5566362471336n, btc: 391293076761970000n });
  });

  it("ignores a Claim from another contract", () => {
    expect(findClaimEvent([{ ...claimLog, address: "0x0000000000000000000000000000000000000001" }], testnet)).toBeNull();
  });
});

describe("claimRows", () => {
  it("lists the claimed fees", () => {
    expect(claimRows({ musd: 391293076761970000n, btc: 5566362471336n })).toEqual([
      { label: "MUSD claimed", value: "0.391293 MUSD" },
      { label: "BTC claimed", value: "0.000005 BTC" },
    ]);
  });
});

describe("assertClaimable", () => {
  it("blocks a claim the simulation says would pay nothing (fees claimed elsewhere after the snapshot)", () => {
    expect(() => assertClaimable([0n, 0n])).toThrow(new BlockedError(NOTHING_TO_CLAIM));
    expect(() => assertClaimable([1n, 0n])).not.toThrow();
    expect(() => assertClaimable([0n, 1n])).not.toThrow();
  });
});
