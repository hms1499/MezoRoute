import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import {
  enteredFromBtcRows,
  enteredRows,
  exitedRows,
  findEnteredEvent,
  findEnteredFromBtcEvent,
  findExitedEvent,
  findStakedEvent,
} from "./receipt";

const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const enteredLog = {
  address: "0xb36b2e012003840951cff00fa6b1e3237a110920",
  topics: [
    "0x0a8e6314ed63e6d6ee27c3a46be2a5baa330bf1a4fa3ce4729fef4209d88279a",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
  ],
  data: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001158e460913d0000000000000000000000000000000000000000000000000000000470de4df8200000000000000000000000000000000000000000000000000008aa39c121a27000000000000000000000000000000000000000000000000000000007350e174387c0000000000000000000000000000000000000000000000008a956a9d26512d1300000000000000000000000000000000000000000000000000007350e174387c000000000000000000000000000000000000000000000000007e69be0f4ae255000000000000000000000000000000000000000000000000000e3174f3d5d2ed0000000000000000000000000000000000000000000000000000000000000000",
} as const;

describe("findEnteredEvent", () => {
  it("decodes the live smoke Entered event", () => {
    expect(findEnteredEvent([enteredLog], EXECUTOR)).toEqual({
      caller: ME,
      recipient: ME,
      musdBorrowed: 0n,
      musdIn: 20000000000000000000n,
      fee: 20000000000000000n,
      musdSwapped: 9990000000000000000n,
      btcFromSwap: 126791217068156n,
      musdAdded: 9986004971949206803n,
      btcAdded: 126791217068156n,
      liquidityOut: 35582112086811221n,
      musdRefund: 3995028050793197n,
      btcRefund: 0n,
    });
  });

  it("ignores the same event emitted by another contract", () => {
    const spoofed = { ...enteredLog, address: "0x0000000000000000000000000000000000000001" } as const;
    expect(findEnteredEvent([spoofed], EXECUTOR)).toBeNull();
  });

  it("returns null when the receipt has no Entered event", () => {
    expect(findEnteredEvent([], EXECUTOR)).toBeNull();
  });
});

describe("enteredRows", () => {
  it("lists the live smoke event's values for the receipt", () => {
    const event = findEnteredEvent([enteredLog], EXECUTOR)!;
    expect(enteredRows(event)).toEqual([
      { label: "MUSD in", value: "20 MUSD" },
      { label: "MezoRoute fee", value: "0.02 MUSD" },
      { label: "MUSD swapped", value: "9.99 MUSD" },
      { label: "BTC from the swap", value: "0.000126 BTC" },
      { label: "MUSD deposited", value: "9.986004 MUSD" },
      { label: "BTC deposited", value: "0.000126 BTC" },
      { label: "LP received", value: "0.035582 LP" },
      { label: "MUSD returned", value: "0.003995 MUSD" },
      { label: "BTC returned", value: "0 BTC" },
    ]);
  });
});

describe("enteredRows for Borrow & Deploy", () => {
  it("lists the borrowed MUSD first", () => {
    const event = findEnteredEvent([enteredLog], EXECUTOR)!;
    const rows = enteredRows({ ...event, musdBorrowed: 20_000_000_000_000_000_000n });
    expect(rows[0]).toEqual({ label: "MUSD borrowed", value: "20 MUSD" });
    expect(rows).toHaveLength(10);
  });
});

// The live smoke exit, tx 0x38a45ffe…7e30 (2 Oct 2026).
const exitedLog = {
  address: "0xb36b2e012003840951cff00fa6b1e3237a110920",
  topics: [
    "0x60d07dbee244732f25c764b0682faec5d991001c2be707658ecaf4d12db76c23",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
  ],
  data: "0x00000000000000000000000000000000000000000000000000fcd376919622bc000000000000000000000000000000000000000000000001152acf247df896e50000000000000000000000000000000000000000000000000000e6a1bdd82f39000000000000000000000000000000000000000000000001150e69d644fb1b290000000000000000000000000000000000000000000000022a3938fac2f3b20e0000000000000000000000000000000000000000000000000000000000000000",
} as const;

describe("findExitedEvent", () => {
  it("decodes the live smoke Exited event", () => {
    expect(findExitedEvent([enteredLog, exitedLog], EXECUTOR)).toEqual({
      caller: ME,
      recipient: ME,
      liquidityIn: 71164200333222588n,
      musdRemoved: 19972003253167101669n,
      btcRemoved: 253582349184825n,
      musdFromSwap: 19964010567181212457n,
      musdOut: 39936013820348314126n,
      btcRefund: 0n,
    });
  });

  it("ignores another contract and an Entered event", () => {
    expect(findExitedEvent([{ ...exitedLog, address: "0x0000000000000000000000000000000000000001" }], EXECUTOR)).toBeNull();
    expect(findExitedEvent([enteredLog], EXECUTOR)).toBeNull();
  });

  it("is not mistaken for an Entered event (viem decodes by topic, whatever eventName says)", () => {
    expect(findEnteredEvent([exitedLog], EXECUTOR)).toBeNull();
  });
});

describe("exitedRows", () => {
  it("lists the live exit's values for the receipt", () => {
    expect(exitedRows(findExitedEvent([exitedLog], EXECUTOR)!)).toEqual([
      { label: "LP exited", value: "0.071164 LP" },
      { label: "MUSD from the pool", value: "19.972003 MUSD" },
      { label: "BTC from the pool", value: "0.000253 BTC" },
      { label: "MUSD from selling the BTC", value: "19.96401 MUSD" },
      { label: "MUSD received", value: "39.936013 MUSD" },
      { label: "BTC returned", value: "0 BTC" },
    ]);
  });
});

const stakedLog = {
  address: EXECUTOR,
  topics: encodeEventTopics({ abi: mezoRouteExecutorAbi, eventName: "Staked", args: { recipient: ME } }) as [`0x${string}`, ...`0x${string}`[]],
  data: encodeAbiParameters([{ type: "uint256" }], [35_582_000_000_000_000n]),
} as const;

describe("findStakedEvent", () => {
  it("finds the Staked event and shows both receipt rows", () => {
    const staked = findStakedEvent([enteredLog, stakedLog], EXECUTOR);
    expect(staked).toEqual({ recipient: ME, liquidity: 35_582_000_000_000_000n });
    const entered = findEnteredEvent([enteredLog], EXECUTOR)!;
    // The whole mint is staked: the event carries what the contract staked.
    const rows = enteredRows(entered, { ...staked!, liquidity: entered.liquidityOut });
    expect(rows).toContainEqual({ label: "Staked in the gauge", value: "0.035582 LP" });
    expect(rows).toContainEqual({ label: "LP left in your wallet", value: "0 LP" });
  });

  it("adds no staking rows without the event, and ignores a spoofed contract", () => {
    expect(findStakedEvent([enteredLog], EXECUTOR)).toBeNull();
    expect(findStakedEvent([{ ...stakedLog, address: ME }], EXECUTOR)).toBeNull();
    const entered = findEnteredEvent([enteredLog], EXECUTOR)!;
    expect(enteredRows(entered, null).map((row) => row.label)).not.toContain("Staked in the gauge");
  });
});

// Task 3's live EnteredFromBtc event (tx 0xf0378a9d…cf5, block 16,570,227).
const btcEnteredLog = {
  address: EXECUTOR,
  topics: encodeEventTopics({ abi: mezoRouteExecutorAbi, eventName: "EnteredFromBtc", args: { caller: ME, recipient: ME } }) as [
    `0x${string}`,
    ...`0x${string}`[],
  ],
  data: encodeAbiParameters(
    Array.from({ length: 9 }, () => ({ type: "uint256" as const })),
    [300000000000000n, 300000000000n, 149850000000000n, 11775167457143114855n, 11775167457143114855n, 149790077206098n, 41996811353360838n, 0n, 59922793902n],
  ),
} as const;

describe("findEnteredFromBtcEvent", () => {
  it("decodes the live EnteredFromBtc event", () => {
    expect(findEnteredFromBtcEvent([btcEnteredLog], EXECUTOR)).toEqual({
      caller: ME,
      recipient: ME,
      btcIn: 300000000000000n,
      fee: 300000000000n,
      btcToSwap: 149850000000000n,
      musdFromSwap: 11775167457143114855n,
      musdAdded: 11775167457143114855n,
      btcAdded: 149790077206098n,
      liquidityOut: 41996811353360838n,
      musdRefund: 0n,
      btcRefund: 59922793902n,
    });
  });

  it("ignores another contract and the MUSD event, and is not mistaken for it", () => {
    expect(findEnteredFromBtcEvent([{ ...btcEnteredLog, address: ME }], EXECUTOR)).toBeNull();
    expect(findEnteredFromBtcEvent([enteredLog], EXECUTOR)).toBeNull();
    expect(findEnteredEvent([btcEnteredLog], EXECUTOR)).toBeNull();
  });
});

describe("enteredFromBtcRows", () => {
  it("lists the realised values, BTC to eight decimals (a BTC entry is a fraction of a coin)", () => {
    expect(enteredFromBtcRows(findEnteredFromBtcEvent([btcEnteredLog], EXECUTOR)!)).toEqual([
      { label: "BTC in", value: "0.0003 BTC" },
      { label: "MezoRoute fee", value: "0.0000003 BTC" },
      { label: "BTC swapped", value: "0.00014985 BTC" },
      { label: "MUSD from the swap", value: "11.775167 MUSD" },
      { label: "MUSD deposited", value: "11.775167 MUSD" },
      { label: "BTC deposited", value: "0.00014979 BTC" },
      { label: "LP received", value: "0.041996 LP" },
      { label: "MUSD returned", value: "0 MUSD" },
      { label: "BTC returned", value: "0.00000005 BTC" },
    ]);
  });
});
