import { describe, expect, it } from "vitest";
import { explorerTxUrl, networks } from "@/lib/config/networks";
import { txRows } from "./tx-rows";

// U14 §A: the receipt card says what happened; its aside says which transaction (hash, block, gas, fee).
const HASH = "0x415b5af4db1f5e0415d7802f7f0cf468b5b3ab3556c43e59746243685b4a1445";

describe("txRows", () => {
  it("names the transaction, its block, its gas, and what it cost", () => {
    const rows = txRows({ transactionHash: HASH, blockNumber: 13_127_274n, gasUsed: 417_468n, effectiveGasPrice: 1_000_000n }, networks.mainnet);
    expect(rows).toEqual([
      { label: "Transaction", value: "0x415b…1445", href: explorerTxUrl(networks.mainnet, HASH) },
      { label: "Block", value: "13,127,274" },
      { label: "Gas used", value: "417,468" },
      { label: "Network fee", value: "0.00000041 BTC" },
    ]);
  });

  it("before the receipt, names only the transaction", () => {
    expect(txRows({ transactionHash: HASH }, networks.testnet)).toEqual([
      { label: "Transaction", value: "0x415b…1445", href: explorerTxUrl(networks.testnet, HASH) },
    ]);
  });
});
