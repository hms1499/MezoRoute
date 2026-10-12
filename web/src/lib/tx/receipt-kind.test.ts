import { encodeAbiParameters, type Hex } from "viem";
import { describe, expect, it } from "vitest";
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

describe("receiptKind", () => {
  it("finds a pool Claim when the receipt has no executor event", () => {
    expect(receiptKind([claim], testnet)).toEqual({ kind: "claim", fees: { musd: 3n, btc: 4n } });
  });

  it("is null for a receipt without MezoRoute or pool events", () => {
    expect(receiptKind([], testnet)).toBeNull();
  });
});
