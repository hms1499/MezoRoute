import { encodeAbiParameters, getAddress, pad, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";
import { findSpReceipt, spReceiptRows } from "./receipt";

const ONE = 10n ** 18n;
const SP = networks.testnet.addresses.stabilityPool;
const MUSD = networks.testnet.addresses.musd;
const DEPOSITOR = "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826";

// tx 0x9062b702bb46635dbf78b5aa55405e180fbb57093cc501ffa86d08fbe36c3cc6 (testnet block 15,439,988):
// a contract depositor's provideToSP(15 MUSD); its own logs come first.
const LIVE_DEPOSIT: LogLike[] = [
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
  { address: "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7"], data: "0x00000000000000000000000000000000000000000000032d26d12e980b600000" },
  { address: "0xe3b02b215085b99ce61e0f5ea9763ac637aa7826", topics: ["0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7", "0x000000000000000000000000e111c592f751462e67d0f0891e8ae10136440af7"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc000000000000000000000000000000000000000000000000032d26d12e980b600000" },
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826", "0x0000000000000000000000001cca7e410ee41739792ea0a24e00349dd247680e"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xc48943df4095f4f20d171fd2872eafdc0eed4d9014ac3672f3bde7fd425449d5", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x0000000000000000000000000000000000000000000000000bf78bd6c4f3ed8600000000000000000000000000000000000000163e1cbf80b61c43ffbc0cbc26" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x000000000000000000000000000000000000000000000002ed6689e54f180000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0x47647c495a7db9471a1b024b3c6f7555a502a0de4b130d83a4d3c8f9cff25939", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826"], data: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" },
  { address: "0x1cca7e410ee41739792ea0a24e00349dd247680e", topics: ["0xfb502a10a442e29149185372d74b953304b5bc0a0d9d431c070905d3dfbc89e3"], data: "0x0000000000000000000000000000000000000000004754566080a0ea403fdd9f" },
  { address: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x000000000000000000000000e3b02b215085b99ce61e0f5ea9763ac637aa7826", "0x0000000000000000000000001cca7e410ee41739792ea0a24e00349dd247680e"], data: "0x000000000000000000000000000000000000000000000000d02ab486cedc0000" },
];

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const word = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]);
const topic = (address: Address) => pad(address.toLowerCase() as Address, { size: 32 });
const depositChanged = (newDeposit: bigint): LogLike => ({
  address: SP,
  topics: ["0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9", topic(DEPOSITOR)],
  data: word(newDeposit),
});
const gainWithdrawn = (gain: bigint, loss: bigint): LogLike => ({
  address: SP,
  topics: ["0x47647c495a7db9471a1b024b3c6f7555a502a0de4b130d83a4d3c8f9cff25939", topic(DEPOSITOR)],
  data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [gain, loss]),
});
const transfer = (from: Address, to: Address, value: bigint): LogLike => ({ address: MUSD, topics: [TRANSFER, topic(from), topic(to)] as Hex[], data: word(value) });

describe("findSpReceipt", () => {
  it("decodes the live provideToSP: 15 MUSD in, deposit now 54 MUSD", () => {
    expect(findSpReceipt(LIVE_DEPOSIT, networks.testnet)).toEqual({
      kind: "sp-deposit",
      depositor: getAddress(DEPOSITOR), // viem returns checksummed addresses
      amount: 15n * ONE,
      gain: 0n,
      loss: 0n,
      depositAfter: 54n * ONE,
    });
  });

  it("reads MUSD sent from the pool to the depositor as a withdrawal", () => {
    const logs = [transfer(SP, DEPOSITOR, 40n * ONE), depositChanged(0n), gainWithdrawn(3n, 5n * ONE)];
    expect(findSpReceipt(logs, networks.testnet)).toMatchObject({ kind: "sp-withdraw", amount: 40n * ONE, gain: 3n, loss: 5n * ONE, depositAfter: 0n });
  });

  it("reads a call that moves no MUSD as a BTC-gain claim", () => {
    expect(findSpReceipt([depositChanged(40n * ONE), gainWithdrawn(3n, 0n)], networks.testnet)).toMatchObject({ kind: "sp-claim", amount: 0n, gain: 3n });
  });

  it("ignores another contract's look-alike events and returns null without pool events", () => {
    const fake = { ...depositChanged(1n), address: MUSD };
    expect(findSpReceipt([fake], networks.testnet)).toBeNull();
  });

  it("lists the rows of a deposit", () => {
    const rows = spReceiptRows({ kind: "sp-deposit", depositor: DEPOSITOR, amount: 15n * ONE, gain: 0n, loss: 0n, depositAfter: 54n * ONE });
    expect(rows.map((row) => row.label)).toEqual(["MUSD deposited", "BTC gain paid", "Deposit loss realised", "Deposit now"]);
  });
});
