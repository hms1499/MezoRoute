import { QueryClient } from "@tanstack/react-query";
import { custom, decodeFunctionData, defineChain, encodeFunctionResult, erc20Abi, multicall3Abi, type Hex } from "viem";
import { createConfig, type Config } from "wagmi";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { gaugeContracts } from "./state";
import { snapshotReadsQuery, unwrapSnapshotReads } from "./snapshot-reads";

const ok = (result: unknown) => ({ status: "success" as const, result });
const failed = (message = "boom") => ({ status: "failure" as const, error: new Error(message), result: undefined });

describe("unwrapSnapshotReads", () => {
  const range = { start: 1, count: 2 };

  it("returns the values when every read succeeded", () => {
    expect(unwrapSnapshotReads([ok(1n), ok(2n), ok(3n), ok(4n)], range)).toEqual({ results: [1n, 2n, 3n, 4n], gaugeReadFailed: false });
  });

  it("drops the whole gauge range when any gauge read failed", () => {
    expect(unwrapSnapshotReads([ok(1n), ok(2n), failed(), ok(4n)], range)).toEqual({ results: [1n, 4n], gaugeReadFailed: true });
  });

  it("raises a failed non-gauge read, with its own error", () => {
    const failure = failed("price feed");
    expect(() => unwrapSnapshotReads([failure, ok(2n), ok(3n), ok(4n)], range)).toThrow(failure.error);
    expect(() => unwrapSnapshotReads([ok(1n), ok(2n), ok(3n), failed("tail")], range)).toThrow("tail");
  });

  it("raises a non-gauge failure rather than blaming the gauge when both failed", () => {
    expect(() => unwrapSnapshotReads([ok(1n), failed("gauge"), ok(3n), failed("tail")], range)).toThrow("tail");
  });

  it("has nothing to fail on a network without a gauge", () => {
    expect(unwrapSnapshotReads([ok(1n)], { start: 1, count: 0 })).toEqual({ results: [1n], gaugeReadFailed: false });
  });
});

// The real wagmi and viem code paths: with allowFailure, a dead RPC does not reject the multicall; it reports every call as a failure.
describe("snapshotReadsQuery through wagmi and viem", () => {
  const network = networks.testnet;
  const account = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8";
  const chain = defineChain({
    id: network.chainId,
    name: "test",
    nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
    rpcUrls: { default: { http: [network.rpcUrl] } },
    contracts: { multicall3: { address: network.addresses.multicall3 } },
  });
  const musdRead = { chainId: network.chainId, address: network.addresses.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] } as const;
  const contracts = [musdRead, ...gaugeContracts(network, account), musdRead] as const;

  /** A node answering each aggregate3 sub-call in order: `failIndex` reverts that one, `rpcDown` fails the whole request. */
  function node(mode: { rpcDown?: () => boolean; failIndex?: number }) {
    const calls = { count: 0 };
    const config = createConfig({
      chains: [chain] as const,
      multiInjectedProviderDiscovery: false,
      storage: null,
      transports: {
        [network.chainId]: custom(
          {
            async request({ method, params }: { method: string; params: unknown[] }) {
              if (method !== "eth_call") throw new Error(`unexpected ${method}`);
              calls.count += 1;
              if (mode.rpcDown?.()) throw new Error("Failed to fetch");
              const { data } = params[0] as { data: Hex };
              const { args } = decodeFunctionData({ abi: multicall3Abi, data });
              const replies = (args![0] as readonly unknown[]).map((_, index) => {
                if (index === mode.failIndex) return { success: false, returnData: "0x" as Hex };
                const contract = contracts[index]!;
                const value = { isAlive: true, balanceOf: 7n, rewardRate: 1n, periodFinish: 2n, totalSupply: 3n, earned: 4n }[contract.functionName as string];
                return {
                  success: true,
                  returnData: encodeFunctionResult({ abi: contract.abi, functionName: contract.functionName, result: value } as never),
                };
              });
              return encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: replies });
            },
          },
          { retryCount: 0 },
        ),
      } as never,
    }) as unknown as Config;
    return { config, calls };
  }
  const options = (config: Config) => snapshotReadsQuery(config, { network, contracts, gaugeStart: 1 });

  it("reads every value when the node answers", async () => {
    const { config } = node({});
    const data = await new QueryClient().fetchQuery(options(config));
    expect(data.gaugeReadFailed).toBe(false);
    expect(data.results).toEqual([7n, true, 1n, 2n, 3n, 7n, 4n, 7n]);
  });

  it("keeps the page's reads when only a gauge read reverts", async () => {
    const { config } = node({ failIndex: 2 });
    const data = await new QueryClient().fetchQuery(options(config));
    expect(data).toEqual({ results: [7n, 7n], gaugeReadFailed: true });
  });

  it("raises a reverted non-gauge read", async () => {
    const { config } = node({ failIndex: 0 });
    await expect(new QueryClient().fetchQuery(options(config))).rejects.toThrow();
  });

  it("raises a dead RPC instead of reporting a gauge failure, and retries it like any failed query", async () => {
    const { config, calls } = node({ rpcDown: () => true });
    await expect(new QueryClient().fetchQuery({ ...options(config), retry: 2, retryDelay: 0 })).rejects.toThrow(/Failed to fetch/);
    expect(calls.count).toBe(3);
  });

  it("keeps the last good data when a later fetch fails, as the pages rely on", async () => {
    let down = false;
    const { config } = node({ rpcDown: () => down });
    const client = new QueryClient();
    const query = { ...options(config), retry: false as const, staleTime: 0 };
    const first = await client.fetchQuery(query);
    down = true;
    await expect(client.fetchQuery(query)).rejects.toThrow();
    const state = client.getQueryState(query.queryKey);
    expect(state?.data).toEqual(first);
    expect(state?.error).toBeInstanceOf(Error);
  });
});
