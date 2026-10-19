import {
  BlockNotFoundError,
  CallExecutionError,
  encodeErrorResult,
  ExecutionRevertedError,
  HttpRequestError,
  RpcRequestError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type TransactionReceipt,
} from "viem";
import { ConnectorChainMismatchError, type Config } from "wagmi";
import { estimateGas, getAccount, getTransactionReceipt, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import {
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionReplacedError,
  TransactionRevertedError,
} from "./errors";
import { SAFE_EXECUTION_FAILURE_TOPIC } from "./safe";
import { assertTxHash, confirmCall, isTxHash, receiptFailure, sendCall, submitCall } from "./send";

vi.mock("wagmi/actions", () => ({
  estimateGas: vi.fn(),
  getAccount: vi.fn(),
  getTransactionReceipt: vi.fn(),
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

const config = {} as Config;
const HASH = "0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf";
const PIN = { account: "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8", chainId: 31611 } as const;
const CALL = { to: "0xB36B2E012003840951CFf00fA6b1E3237A110920", data: "0x1234" } as const;

function receipt(overrides: Record<string, unknown> = {}): TransactionReceipt {
  return { status: "success", logs: [], transactionHash: HASH, ...overrides } as unknown as TransactionReceipt;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccount).mockReturnValue({ connector: { type: "injected", id: "io.metamask" } } as never);
  vi.mocked(sendTransaction).mockResolvedValue(HASH);
  vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt() as never);
  vi.mocked(getTransactionReceipt).mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH }));
  // The explorer receipt fallback must never reach the network in tests: it answers "no receipt".
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: null }) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertTxHash", () => {
  it("accepts a 32-byte hash", () => {
    expect(assertTxHash(HASH)).toBe(HASH);
  });

  it.each(["0x", "", undefined, null, "0x1234"])("rejects %j as a relay failure", (value) => {
    expect(() => assertTxHash(value)).toThrow(RelayError);
  });
});

describe("sendCall", () => {
  it("pins the account and chain on the send and the receipt wait", async () => {
    await expect(sendCall(config, CALL, PIN)).resolves.toMatchObject({ transactionHash: HASH });
    expect(sendTransaction).toHaveBeenCalledWith(config, { ...CALL, account: PIN.account, chainId: 31611 });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ hash: HASH, chainId: 31611 }),
    );
  });

  it("lets wagmi's chain-mismatch error through so the decoder can offer Switch network", async () => {
    const mismatch = new ConnectorChainMismatchError({ connectionChainId: 31611, connectorChainId: 1 });
    vi.mocked(sendTransaction).mockRejectedValue(mismatch);
    await expect(sendCall(config, CALL, PIN)).rejects.toBe(mismatch);
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("treats the relayer's '0x' hash as a relay failure", async () => {
    vi.mocked(sendTransaction).mockResolvedValue("0x" as never);
    await expect(sendCall(config, CALL, PIN)).rejects.toBeInstanceOf(RelayError);
  });

  it("re-labels an OrangeKit fetch failure as a relay failure", async () => {
    vi.mocked(getAccount).mockReturnValue({ connector: { type: "orangekit" } } as never);
    vi.mocked(sendTransaction).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendCall(config, CALL, PIN)).rejects.toBeInstanceOf(RelayError);
  });

  it("fails a confirmed Safe transaction whose inner call reverted", async () => {
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(
      receipt({ logs: [{ topics: [SAFE_EXECUTION_FAILURE_TOPIC] }] }) as never,
    );
    await expect(sendCall(config, CALL, PIN)).rejects.toBeInstanceOf(SmartAccountCallFailedError);
  });

  it("fails a reverted receipt with its hash", async () => {
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt({ status: "reverted" }) as never);
    await expect(sendCall(config, CALL, PIN)).rejects.toMatchObject({ name: "TransactionRevertedError", hash: HASH });
  });

  it("classifies a failed receipt wait and keeps the hash", async () => {
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(new WaitForTransactionReceiptTimeoutError({ hash: HASH }));
    await expect(sendCall(config, CALL, PIN)).rejects.toMatchObject({ name: "ConfirmationTimeoutError", hash: HASH });
  });
});

describe("receiptFailure", () => {
  const revertData = encodeErrorResult({ abi: mezoRouteExecutorAbi, errorName: "Expired" });
  // What viem's `call` throws when wagmi's replay of a reverted transaction reverts again.
  const replayReverted = new CallExecutionError(
    new ExecutionRevertedError({
      cause: new RpcRequestError({
        body: {},
        url: "https://rpc.test.mezo.org",
        error: { code: 3, message: "execution reverted", data: revertData },
      }),
      message: "execution reverted",
    }),
    {},
  );

  it.each([
    ["wagmi's Error(reason) after a replay that succeeded", new Error(""), TransactionRevertedError],
    ["a replay that reverted with data", replayReverted, TransactionRevertedError],
    ["viem's receipt timeout", new WaitForTransactionReceiptTimeoutError({ hash: HASH }), ConfirmationTimeoutError],
    ["an RPC failure while polling", new HttpRequestError({ url: "https://rpc.test.mezo.org" }), ConfirmationTimeoutError],
    // viem's replacement check after a null receipt: the flaky testnet RPC returns null again.
    ["a receipt still missing after viem's replacement check", new TransactionReceiptNotFoundError({ hash: HASH }), ConfirmationTimeoutError],
    ["a block the RPC cannot find yet", new BlockNotFoundError({ blockNumber: 15_936_717n }), ConfirmationTimeoutError],
  ] as const)("maps %s", (_name, error, expected) => {
    const result = receiptFailure(error, HASH);
    expect(result).toBeInstanceOf(expected);
    expect(result.hash).toBe(HASH);
    expect(result.cause).toBe(error);
  });
});

describe("isTxHash", () => {
  it("accepts only a 32-byte hex hash", () => {
    expect(isTxHash(HASH)).toBe(true);
    for (const value of ["0x", HASH.slice(0, 65), `${HASH}00`, "hello", null, undefined, 42]) {
      expect(isTxHash(value)).toBe(false);
    }
  });
});

describe("submitCall", () => {
  it("returns the hash without waiting for the receipt", async () => {
    await expect(submitCall(config, CALL, PIN)).resolves.toBe(HASH);
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("sets the gas limit itself for an EVM wallet: the budget when the RPC estimate is too low or fails", async () => {
    vi.mocked(estimateGas).mockResolvedValue(24_408n);
    await submitCall(config, CALL, PIN, 495_000n);
    expect(sendTransaction).toHaveBeenLastCalledWith(config, expect.objectContaining({ gas: 495_000n }));
    vi.mocked(estimateGas).mockRejectedValue(new Error("rpc"));
    await submitCall(config, CALL, PIN, 495_000n);
    expect(sendTransaction).toHaveBeenLastCalledWith(config, expect.objectContaining({ gas: 495_000n }));
    vi.mocked(estimateGas).mockResolvedValue(1_000_000n);
    await submitCall(config, CALL, PIN, 495_000n);
    expect(sendTransaction).toHaveBeenLastCalledWith(config, expect.objectContaining({ gas: 1_200_000n }));
  });

  it("leaves gas to the relayer for a Bitcoin wallet's smart account", async () => {
    vi.mocked(getAccount).mockReturnValue({ connector: { type: "orangekit", id: "orangekit-unisat" } } as never);
    await submitCall(config, CALL, PIN, 495_000n);
    expect(estimateGas).not.toHaveBeenCalled();
    expect(vi.mocked(sendTransaction).mock.calls[0][1]).not.toHaveProperty("gas");
  });
});

describe("confirmCall", () => {
  const REPLACEMENT = "0x1111111111111111111111111111111111111111111111111111111111111111";

  function replacedWith(reason: "repriced" | "cancelled" | "replaced") {
    vi.mocked(waitForTransactionReceipt).mockImplementation((async (_config: Config, options: { onReplaced?: (r: unknown) => void }) => {
      options.onReplaced?.({ reason, transaction: { hash: REPLACEMENT } });
      return receipt({ transactionHash: REPLACEMENT });
    }) as never);
  }

  it("accepts a repriced (sped-up) copy of the same call", async () => {
    replacedWith("repriced");
    await expect(confirmCall(config, HASH, 31611)).resolves.toMatchObject({ transactionHash: REPLACEMENT });
  });

  it.each(["cancelled", "replaced"] as const)("fails when the wallet %s the transaction", async (reason) => {
    replacedWith(reason);
    const error = await confirmCall(config, HASH, 31611).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TransactionReplacedError);
    expect(error).toMatchObject({ hash: HASH, replacement: REPLACEMENT });
  });

  it("waits on the given chain", async () => {
    await confirmCall(config, HASH, 31611);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(config, expect.objectContaining({ hash: HASH, chainId: 31611 }));
  });
});

describe("confirmCall on the flaky testnet RPC", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps waiting after a null-receipt miss instead of reporting a mined transaction as unconfirmed", async () => {
    vi.useFakeTimers();
    vi.mocked(waitForTransactionReceipt)
      .mockRejectedValueOnce(new BlockNotFoundError({ blockNumber: 15_936_717n }))
      .mockResolvedValueOnce(receipt() as never);
    const confirmed = confirmCall(config, HASH, 31611);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(confirmed).resolves.toMatchObject({ transactionHash: HASH });
    expect(waitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });

  it("reports unconfirmed once the 120 s budget is spent", async () => {
    vi.useFakeTimers();
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH }));
    const confirmed = confirmCall(config, HASH, 31611).catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(121_000);
    expect(await confirmed).toBeInstanceOf(ConfirmationTimeoutError);
    expect(vi.mocked(waitForTransactionReceipt).mock.calls.length).toBeLessThanOrEqual(61);
  });

  it("does not wait again after viem's own timeout or a revert", async () => {
    vi.mocked(waitForTransactionReceipt).mockRejectedValueOnce(new WaitForTransactionReceiptTimeoutError({ hash: HASH }));
    await expect(confirmCall(config, HASH, 31611)).rejects.toBeInstanceOf(ConfirmationTimeoutError);
    vi.mocked(waitForTransactionReceipt).mockRejectedValueOnce(new Error("execution reverted"));
    await expect(confirmCall(config, HASH, 31611)).rejects.toBeInstanceOf(TransactionRevertedError);
    expect(waitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });

  it("finds the receipt directly when viem is stuck on eth_getTransactionByHash returning null", async () => {
    // 19 Oct 2026: the testnet RPC answered null for a mined transaction's eth_getTransactionByHash for minutes;
    // viem kept asking for the transaction and never asked for the receipt again.
    vi.useFakeTimers();
    vi.mocked(waitForTransactionReceipt).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(getTransactionReceipt)
      .mockRejectedValueOnce(new TransactionReceiptNotFoundError({ hash: HASH }))
      .mockResolvedValueOnce(receipt() as never);
    const confirmed = confirmCall(config, HASH, 31611);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(confirmed).resolves.toMatchObject({ transactionHash: HASH });
    expect(getTransactionReceipt).toHaveBeenCalledWith(config, { hash: HASH, chainId: 31611 });
  });

  it("still reports a revert found by the direct receipt poll", async () => {
    vi.useFakeTimers();
    vi.mocked(waitForTransactionReceipt).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(getTransactionReceipt).mockResolvedValue(receipt({ status: "reverted" }) as never);
    const confirmed = confirmCall(config, HASH, 31611).catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await confirmed).toBeInstanceOf(TransactionRevertedError);
  });

  it("stops polling for the receipt once viem has confirmed", async () => {
    vi.useFakeTimers();
    await confirmCall(config, HASH, 31611);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("falls back to the explorer's eth-rpc when the RPC node keeps answering null for the receipt", async () => {
    // 19 Oct 2026: the browser's one connection to rpc.test.mezo.org stayed on a node that lacked the mined
    // transaction, so even direct receipt requests answered null; the explorer's indexer had it.
    vi.useFakeTimers();
    vi.mocked(waitForTransactionReceipt).mockReturnValue(new Promise(() => {}) as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: {
          blockHash: "0x7a29ffe13b909200d69279de2eff0741c86e91dcd39be3f8b2a8d864465d9db9",
          blockNumber: "0xf7c553",
          contractAddress: null,
          cumulativeGasUsed: "0x5321f",
          effectiveGasPrice: "0x92",
          from: PIN.account,
          gasUsed: "0x5321f",
          logs: [],
          logsBloom: "0x" + "0".repeat(512),
          status: "0x1",
          to: CALL.to,
          transactionHash: HASH,
          transactionIndex: "0x0",
          type: "0x2",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const confirmed = confirmCall(config, HASH, 31611);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(confirmed).resolves.toMatchObject({ transactionHash: HASH, status: "success", blockNumber: 16_237_907n });
    expect(fetchMock).toHaveBeenCalledWith("https://api.explorer.test.mezo.org/api/eth-rpc", expect.objectContaining({ method: "POST" }));
  });
});
