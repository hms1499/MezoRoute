import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { proofContracts } from "@/lib/proof/contracts";
import type { ProofRow } from "@/lib/proof/rows";
import { ContractsCard } from "./ContractsCard";
import { TransactionsCard } from "./TransactionsCard";

const contracts = (id: "mainnet" | "testnet") =>
  renderToStaticMarkup(createElement(ContractsCard, { network: networks[id], contracts: proofContracts(networks[id]) }));

const row = (i: number, walletKind: "team" | "outside" = "team"): ProofRow => ({
  key: `0x${i}:1`,
  txHash: `0xa0f1${String(i).padStart(56, "0")}6a96`,
  block: 13_190_000n - BigInt(i),
  logIndex: 1,
  time: 1_794_488_640n - BigInt(i * 60),
  action: "exit",
  staked: false,
  label: "Exit",
  result: "0.0146 LP → 7.95 MUSD",
  contract: "Executor V2",
  wallet: "0xd2041f7bdc6e7da48d7e07ef1fa4ee0e070c190c",
  walletKind,
});
const transactions = (props: Partial<Parameters<typeof TransactionsCard>[0]>) =>
  renderToStaticMarkup(createElement(TransactionsCard, { network: networks.mainnet, rows: undefined, error: null, onRetry: () => undefined, ...props }));

describe("ContractsCard", () => {
  it("lists the mainnet contracts with their explorer links, deploy date, and verification", () => {
    const out = contracts("mainnet");
    expect(out).toContain("Executor V2");
    expect(out).toContain("0xb346…7915");
    expect(out).toContain(`https://explorer.mezo.org/address/${networks.mainnet.executor!.address}`);
    expect(out).toContain("6 Nov 2026");
    expect(out).toContain("Verified");
    expect(out).toContain("Unaudited");
    expect(out).not.toContain("Testnet tokens have no value");
  });

  it("says testnet tokens have no value on testnet", () => {
    expect(contracts("testnet")).toContain("Testnet tokens have no value");
  });
});

describe("TransactionsCard", () => {
  it("shows the first 10 of 25 and offers the rest", () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(i, i === 0 ? "outside" : "team"));
    const out = transactions({ rows });
    expect(out.match(/0\.0146 LP → 7\.95 MUSD/g)?.length).toBe(20); // 10 rows, once as a table and once as a card
    expect(out).toContain("Show all 25");
    expect(out).toContain("outside");
    expect(out).toContain("0xd204…190c");
  });

  it("shows an error with Retry and no table", () => {
    const out = transactions({ error: new Error("Explorer HTTP 502") });
    expect(out).toContain("Retry");
    expect(out).not.toContain("<table");
  });

  it("says when there is nothing yet", () => {
    expect(transactions({ rows: [] })).toContain("No transactions yet.");
  });
});
