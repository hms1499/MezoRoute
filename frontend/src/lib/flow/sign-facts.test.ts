import { describe, expect, it } from "vitest";
import { REPOSITORY } from "@/lib/config/links";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { lpSignFacts, spSignFacts, troveSignFacts } from "./sign-facts";

// U14 §A: the facts a person gives up the moment they sign, one helper per route kind. Each ends with Audit and Reads.

const testnet = networks.testnet;
const labels = (facts: { label: string }[] | null) => facts?.map((f) => f.label);

describe("lpSignFacts", () => {
  const facts = lpSignFacts(testnet, { feeBps: 10n, capMusd: 1_000_000n * 10n ** 18n, blockNumber: 13_127_274n });

  it("names the executor, the fee, the cap, the audit, and the block", () => {
    expect(labels(facts)).toEqual(["Executor", "MezoRoute fee", "Entry cap", "Audit", "Reads"]);
    expect(facts?.[0]).toEqual({ label: "Executor", value: "0x1281…6288", href: explorerAddressUrl(testnet, testnet.executor!.address) });
    expect(facts?.[1].value).toBe("0.1%");
    expect(facts?.[2].value).toBe("1,000,000 MUSD");
    expect(facts?.[3]).toEqual({ label: "Audit", value: "Unaudited software", href: REPOSITORY });
    expect(facts?.[4].value).toBe("Block 13,127,274");
  });

  it("needs no account: a wallet-less planner shows the same facts", () => {
    expect(lpSignFacts.length).toBe(2);
  });

  it("on exit, says how the LP is pulled instead of the entry cap", () => {
    const evm = lpSignFacts(testnet, { feeBps: 10n, capMusd: null, blockNumber: 1n, exit: { walletKind: "evm" } });
    const smart = lpSignFacts(testnet, { feeBps: 10n, capMusd: null, blockNumber: 1n, exit: { walletKind: "smart" } });
    expect(labels(evm)).toEqual(["Executor", "MezoRoute fee", "Approval", "Audit", "Reads"]);
    expect(evm?.[2].value).toBe("LP permit (a signature)");
    expect(smart?.[2].value).toBe("Exact LP approval");
  });

  it("is null without an executor", () => {
    expect(lpSignFacts({ ...testnet, executor: null }, { feeBps: 10n, capMusd: 1n, blockNumber: 1n })).toBeNull();
  });
});

describe("spSignFacts", () => {
  const facts = spSignFacts(testnet, 16_700_000n);

  it("names Mezo's pool, no fee, the exact approval, and the block", () => {
    expect(labels(facts)).toEqual(["Contract", "MezoRoute fee", "Approval", "Audit", "Reads"]);
    expect(facts[0]).toEqual({ label: "Contract", value: "Stability Pool", href: explorerAddressUrl(testnet, testnet.addresses.stabilityPool) });
    expect(facts.slice(1, 4).map((f) => f.value)).toEqual(["None", "Exact amount", "Mezo's contract; MezoRoute adds none"]);
    expect(facts[3].href).toBeUndefined();
    expect(facts[4].value).toBe("Block 16,700,000");
  });
});

describe("troveSignFacts", () => {
  const leverage = testnet.leverage!;
  const facts = troveSignFacts(testnet, { feeBps: leverage.feeBps, maxBtcFlash: leverage.maxBtcFlash, maxMusdFlash: leverage.maxMusdFlash, blockNumber: 1n });

  it("names the leverage contract, its fee, its caps, the signatures, the audit, and the block", () => {
    expect(labels(facts)).toEqual(["Contract", "MezoRoute fee", "Per-transaction cap", "Signatures", "Audit", "Reads"]);
    expect(facts?.[0]).toEqual({ label: "Contract", value: "MezoRouteLeverage", href: explorerAddressUrl(testnet, leverage.address) });
    expect(facts?.[2].value).toBe("12 BTC / 1,000,000 MUSD");
    expect(facts?.[3].value).toBe("Trove authorisation and permit (EVM wallets only)");
    expect(facts?.[4].href).toBe(REPOSITORY);
  });

  it("is null without the leverage contract", () => {
    expect(troveSignFacts({ ...testnet, leverage: null }, { feeBps: 10n, maxBtcFlash: 1n, maxMusdFlash: 1n, blockNumber: 1n })).toBeNull();
  });
});
