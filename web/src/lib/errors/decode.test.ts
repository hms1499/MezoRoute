import {
  CallExecutionError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  ExecutionRevertedError,
  HttpRequestError,
  parseAbi,
  RpcRequestError,
  UserRejectedRequestError,
  type Abi,
  type Hex,
} from "viem";
import { ConnectorAccountNotFoundError, ConnectorChainMismatchError } from "wagmi";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { tigrisErrorsAbi } from "@/lib/abi/tigrisErrors";
import { networks } from "@/lib/config/networks";
import {
  asRelayFailure,
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionRevertedError,
} from "@/lib/tx/errors";
import { decodeError, MAX_DETAILS } from "./decode";

const testnet = networks.testnet;
const mainnet = networks.mainnet;
const HASH = "0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf";
const ozAbi = parseAbi([
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error Error(string message)",
  "error Panic(uint256 code)",
]);
const SPENDER = "0xB36B2E012003840951CFf00fA6b1E3237A110920";

/** What viem's writeContract/simulateContract throws for a revert with this data. */
function contractRevert(data: Hex) {
  const reverted = new ContractFunctionRevertedError({ abi: mezoRouteExecutorAbi, data, functionName: "enter" });
  return new ContractFunctionExecutionError(reverted, { abi: mezoRouteExecutorAbi, functionName: "enter", args: [] });
}

/** What viem's `call` (and sendTransaction's gas estimate) throws when the node reports revert data. */
function callRevert(data: Hex) {
  return new CallExecutionError(
    new ExecutionRevertedError({
      cause: new RpcRequestError({
        body: {},
        url: "https://rpc.test.mezo.org",
        error: { code: 3, message: "execution reverted", data },
      }),
      message: "execution reverted",
    }),
    {},
  );
}

function encode(abi: Abi, errorName: string, args?: readonly unknown[]): Hex {
  return encodeErrorResult({ abi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
}

describe("decodeError: wallet, relayer, and connection errors", () => {
  it.each([
    ["viem's UserRejectedRequestError", new UserRejectedRequestError(new Error("User rejected the request."))],
    ["a rejection deeper in the cause chain", new Error("Failed to send", { cause: new Error("User rejected the request.") })],
    ["OrangeKit's plain-object Xverse rejection", { code: 4001, message: "The user rejected the request." }],
    ["code 4001 whatever the wording", { code: 4001, message: "Denied" }],
  ])("maps %s to a rejection (spec 13)", (_name, error) => {
    expect(decodeError(error, testnet)).toEqual({
      kind: "rejected",
      message: "Transaction was not signed.",
      recovery: ["retry"],
    });
  });

  it("maps relay failures", () => {
    expect(decodeError(new RelayError("no hash"), testnet)).toMatchObject({ kind: "relay", recovery: ["retry"] });
  });

  it.each([
    ["a non-JSON relayer response", new SyntaxError("Unexpected token '<', \"<!doctype \"... is not valid JSON")],
    ["a network or CORS failure", new TypeError("Failed to fetch")],
  ])("maps %s from a Bitcoin wallet to a relay failure", (_name, error) => {
    expect(decodeError(asRelayFailure(error, "orangekit"), testnet).kind).toBe("relay");
  });

  it("maps a reverted smart-account call and keeps the hash", () => {
    expect(decodeError(new SmartAccountCallFailedError(HASH), testnet)).toEqual({
      kind: "smart-account-reverted",
      message: "Your smart account sent the transaction, but the call reverted.",
      recovery: ["retry", "copy-details"],
      details: `Transaction ${HASH}`,
      hash: HASH,
    });
  });

  it("never offers a retry for an unconfirmed transaction (a retry could send twice)", () => {
    const decoded = decodeError(new ConfirmationTimeoutError(HASH, { cause: new HttpRequestError({ url: "x" }) }), testnet);
    expect(decoded).toMatchObject({ kind: "unconfirmed", recovery: ["view-transaction"], hash: HASH });
    expect(decoded.message).toBe(
      "Your transaction was sent but is not confirmed yet. Check it in the explorer before trying again.",
    );
  });

  it("maps wagmi's chain mismatch to Switch network, per network", () => {
    const mismatch = new ConnectorChainMismatchError({ connectionChainId: 31611, connectorChainId: 1 });
    expect(decodeError(mismatch, testnet)).toEqual({
      kind: "wrong-network",
      message: "MezoRoute executes on Mezo Testnet.",
      recovery: ["switch-network"],
    });
    expect(decodeError(mismatch, mainnet).message).toBe("MezoRoute executes on Mezo Mainnet.");
  });

  it("maps a mid-flow account switch", () => {
    const error = new ConnectorAccountNotFoundError({ address: SPENDER, connector: { name: "MetaMask" } as never });
    expect(decodeError(error, testnet)).toMatchObject({ kind: "account-changed", recovery: ["retry"] });
  });

  it("maps missing gas to the faucet on testnet and to a plain message on mainnet", () => {
    const error = new Error("Not enough native token balance to cover transaction gas. Required: 146000 sats.");
    expect(decodeError(error, testnet)).toEqual({
      kind: "needs-gas",
      message: "You need test BTC to submit transactions.",
      recovery: ["add-gas"],
    });
    expect(decodeError(new Error("insufficient funds for gas * price + value"), mainnet)).toEqual({
      kind: "needs-gas",
      message: "You need BTC on Mezo to pay for gas.",
      recovery: [],
    });
  });
});

describe("decodeError: reverts with data", () => {
  it.each([
    ["executor Expired", encode(mezoRouteExecutorAbi, "Expired"), "quote-expired"],
    ["executor InsufficientSwapOutput", encode(mezoRouteExecutorAbi, "InsufficientSwapOutput"), "slippage"],
    ["executor InsufficientLiquidityOutput", encode(mezoRouteExecutorAbi, "InsufficientLiquidityOutput"), "slippage"],
    ["executor InsufficientFinalOutput", encode(mezoRouteExecutorAbi, "InsufficientFinalOutput"), "slippage"],
    ["Router InsufficientOutputAmount", encode(tigrisErrorsAbi, "InsufficientOutputAmount"), "slippage"],
    ["Router InsufficientAmountA", encode(tigrisErrorsAbi, "InsufficientAmountA"), "slippage"],
    ["executor InvalidSwapAmount", encode(mezoRouteExecutorAbi, "InvalidSwapAmount"), "amount-too-small"],
    ["executor ZeroAmount", encode(mezoRouteExecutorAbi, "ZeroAmount"), "amount-too-small"],
    ["OZ5 ERC20InsufficientAllowance", encode(ozAbi, "ERC20InsufficientAllowance", [SPENDER, 0n, 5n]), "allowance"],
    ["OZ5 ERC20InsufficientBalance", encode(ozAbi, "ERC20InsufficientBalance", [SPENDER, 0n, 5n]), "insufficient-balance"],
    ["OZ4 insufficient allowance", encode(ozAbi, "Error", ["ERC20: insufficient allowance"]), "allowance"],
    ["OZ4 exceeds balance", encode(ozAbi, "Error", ["ERC20: transfer amount exceeds balance"]), "insufficient-balance"],
    ["Pool K", encode(tigrisErrorsAbi, "K"), "pool"],
    ["Pool IsPaused", encode(tigrisErrorsAbi, "IsPaused"), "pool"],
  ] as const)("maps %s", (_name, data, kind) => {
    expect(decodeError(contractRevert(data), testnet).kind).toBe(kind);
    expect(decodeError(callRevert(data), testnet).kind).toBe(kind);
  });

  it("words the cap per network", () => {
    const data = encode(mezoRouteExecutorAbi, "AmountAboveCap");
    expect(decodeError(contractRevert(data), mainnet)).toEqual({
      kind: "above-cap",
      message: "Mainnet deposits are limited to 1,000 MUSD per transaction while unaudited.",
      recovery: ["reduce-amount"],
      details: "AmountAboveCap",
    });
    expect(decodeError(contractRevert(data), testnet).message).toBe("Amount is above the per-transaction cap.");
  });

  it("falls back to a generic revert that names the error", () => {
    expect(decodeError(contractRevert(encode(mezoRouteExecutorAbi, "NotBorrower")), testnet)).toEqual({
      kind: "reverted",
      message: "The transaction reverted.",
      recovery: ["retry", "copy-details"],
      details: "NotBorrower",
    });
    expect(decodeError(callRevert(encode(ozAbi, "Panic", [0x11n])), testnet).details).toBe("Panic");
    expect(decodeError(callRevert(encode(ozAbi, "Error", ["Something else"])), testnet).details).toBe("Something else");
  });

  it("reports an unknown selector", () => {
    expect(decodeError(callRevert("0xdeadbeef"), testnet)).toMatchObject({
      kind: "reverted",
      details: "Unknown error 0xdeadbeef",
    });
  });

  it("decodes the revert behind a mined transaction and keeps the hash first in the details", () => {
    const error = new TransactionRevertedError(HASH, { cause: callRevert(encode(mezoRouteExecutorAbi, "Expired")) });
    expect(decodeError(error, testnet)).toEqual({
      kind: "quote-expired",
      message: "Pool state changed; refresh your quote.",
      recovery: ["refresh-quote"],
      details: `Transaction ${HASH}\nExpired`,
      hash: HASH,
    });
  });
});

describe("decodeError: reverts without data, RPC failures, and the rest", () => {
  it("maps wagmi's empty Error after a replay to a generic revert with the hash", () => {
    expect(decodeError(new TransactionRevertedError(HASH, { cause: new Error("") }), testnet)).toEqual({
      kind: "reverted",
      message: "The transaction reverted.",
      recovery: ["retry", "copy-details"],
      details: `Transaction ${HASH}`,
      hash: HASH,
    });
  });

  it("matches a known revert string that only appears in the message", () => {
    expect(decodeError(new Error("execution reverted: ERC20: insufficient allowance"), testnet).kind).toBe("allowance");
  });

  it.each([
    ["viem's HttpRequestError", new HttpRequestError({ url: "https://rpc.test.mezo.org" })],
    ["a fetch failure from an EVM wallet", new TypeError("Failed to fetch")],
  ])("maps %s to an unavailable network", (_name, error) => {
    expect(decodeError(error, testnet)).toEqual({
      kind: "rpc-unavailable",
      message: "Mezo Testnet is temporarily unavailable.",
      recovery: ["retry"],
    });
  });

  it("falls back to a generic message with the original text as details", () => {
    expect(decodeError(new Error("boom"), testnet)).toEqual({
      kind: "unknown",
      message: "Something went wrong.",
      recovery: ["retry", "copy-details"],
      details: "boom",
    });
    expect(decodeError("weird", testnet).details).toBe("weird");
  });

  it("keeps a huge error out of the message and caps the details", () => {
    const html = `<!doctype html>${"<div>relayer error</div>".repeat(220)}`;
    const decoded = decodeError(new Error(html), testnet);
    expect(decoded.message).toBe("Something went wrong.");
    expect(decoded.details?.length).toBe(MAX_DETAILS);
    expect(decoded.details?.endsWith("…")).toBe(true);
  });
});
