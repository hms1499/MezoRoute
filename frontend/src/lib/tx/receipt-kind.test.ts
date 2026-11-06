import { encodeAbiParameters, encodeEventTopics, getAbiItem, toEventSelector, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { gaugeAbi } from "@/lib/abi/gauge";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { networks } from "@/lib/config/networks";
import { receiptKind } from "./receipt-kind";

const testnet = networks.testnet;
const word = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]).slice(2);
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

const claim = {
  address: testnet.addresses.pool,
  topics: ["0x865ca08d59f5cb456e85cd2f7ef63664ea4f73327414e9d8152c4158b0e94645", topic(ME), topic(ME)] as Hex[],
  data: `0x${word(3n)}${word(4n)}` as Hex,
};

// The live smoke Entered event of the testnet V1 executor, now under legacyExecutors.
const V1 = testnet.legacyExecutors[0]!.address;
const v1Entered = {
  address: V1,
  topics: [
    "0x0a8e6314ed63e6d6ee27c3a46be2a5baa330bf1a4fa3ce4729fef4209d88279a",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
    "0x000000000000000000000000d74f60bb70d2a8b412ff12d8ef0ffdaae81b2b49",
  ] as Hex[],
  data: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001158e460913d0000000000000000000000000000000000000000000000000000000470de4df8200000000000000000000000000000000000000000000000000008aa39c121a27000000000000000000000000000000000000000000000000000000007350e174387c0000000000000000000000000000000000000000000000008a956a9d26512d1300000000000000000000000000000000000000000000000000007350e174387c000000000000000000000000000000000000000000000000007e69be0f4ae255000000000000000000000000000000000000000000000000000e3174f3d5d2ed0000000000000000000000000000000000000000000000000000000000000000" as Hex,
};
const v1Exited = {
  address: V1,
  topics: encodeEventTopics({ abi: mezoRouteExecutorAbi, eventName: "Exited", args: { caller: ME, recipient: ME } }) as Hex[],
  data: `0x${[9n, 8n, 7n, 6n, 5n, 4n].map(word).join("")}` as Hex,
};

describe("receiptKind", () => {
  it("reads a legacy V1 entry: the receipt link of an old deposit keeps working", () => {
    expect(receiptKind([v1Entered], testnet)).toMatchObject({ kind: "entered", event: { caller: ME, recipient: ME, musdIn: 20n * 10n ** 18n }, staked: null });
  });

  it("reads a legacy V1 exit", () => {
    expect(receiptKind([v1Exited], testnet)).toMatchObject({ kind: "exited", event: { caller: ME, liquidityIn: 9n, musdOut: 5n } });
  });

  it("ignores the same logs from an address that is no executor", () => {
    const stranger = "0x00000000000000000000000000000000000000aa";
    expect(receiptKind([{ ...v1Entered, address: stranger }, { ...v1Exited, address: stranger }], testnet)).toBeNull();
  });

  it("finds a pool Claim when the receipt has no executor event", () => {
    expect(receiptKind([claim], testnet)).toEqual({ kind: "claim", fees: { musd: 3n, btc: 4n } });
  });

  it("decodes a Stability Pool action when there is no executor or pool event", () => {
    const depositChanged = {
      address: testnet.addresses.stabilityPool,
      topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", topic(ME)] as Hex[],
      data: `0x${word(5n)}` as Hex,
    };
    expect(receiptKind([depositChanged], testnet)).toMatchObject({ kind: "sp-claim", sp: { depositAfter: 5n } });
  });

  it("decodes a gauge claim, stake, and unstake", () => {
    const gauge = testnet.gauge!.address;
    const log = (name: "ClaimRewards" | "Deposit" | "Withdraw", indexed: string[], amount: bigint) => ({
      address: gauge,
      topics: [toEventSelector(getAbiItem({ abi: gaugeAbi, name })), ...indexed.map(topic)] as Hex[],
      data: `0x${word(amount)}` as Hex,
    });
    expect(receiptKind([log("ClaimRewards", [ME], 5n)], testnet)).toEqual({ kind: "gauge", gauge: { action: "claim", amount: 5n } });
    expect(receiptKind([log("Deposit", [ME, ME], 6n)], testnet)).toEqual({ kind: "gauge", gauge: { action: "stake", amount: 6n } });
    expect(receiptKind([log("Withdraw", [ME], 7n)], testnet)).toEqual({ kind: "gauge", gauge: { action: "unstake", amount: 7n } });
  });

  it("is null for a receipt without MezoRoute or pool events", () => {
    expect(receiptKind([], testnet)).toBeNull();
  });
});
