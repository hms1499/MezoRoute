import {
  CallExecutionError,
  encodeErrorResult,
  ExecutionRevertedError,
  HttpRequestError,
  RpcRequestError,
  WaitForTransactionReceiptTimeoutError,
  type TransactionReceipt,
} from "viem";
import { ConnectorChainMismatchError, type Config } from "wagmi";
import { getAccount, sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import {
  ConfirmationTimeoutError,
  RelayError,
  SmartAccountCallFailedError,
  TransactionRevertedError,
} from "./errors";
import { SAFE_EXECUTION_FAILURE_TOPIC } from "./safe";
import { assertTxHash, receiptFailure, sendCall } from "./send";

vi.mock("wagmi/actions", () => ({
  getAccount: vi.fn(),
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
  vi.mocked(getAccount).mockReturnValue({ connector: { type: "injected" } } as never);
  vi.mocked(sendTransaction).mockResolvedValue(HASH);
  vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt() as never);
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
  ] as const)("maps %s", (_name, error, expected) => {
    const result = receiptFailure(error, HASH);
    expect(result).toBeInstanceOf(expected);
    expect(result.hash).toBe(HASH);
    expect(result.cause).toBe(error);
  });
});
