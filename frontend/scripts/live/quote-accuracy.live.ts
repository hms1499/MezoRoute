import { createPublicClient, http, parseAbiItem } from "viem";
import { expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import { networks, type NetworkId } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { checkEntry, earlierPoolActivity, summarise, type CheckResult, type EnteredEvent } from "@/lib/quote/accuracy";
import { DEFAULT_SLIPPAGE, type PoolState } from "@/lib/quote/entry";

// Spec F8 §2: every executor Entered event against the quote engine. Run from frontend/:
//   npm run quote-accuracy                          (testnet)
//   QUOTE_NETWORK=mainnet npm run quote-accuracy    (after M1)

const LOG_RANGE = 10_000n;
const SYNC = parseAbiItem("event Sync(uint256 reserve0, uint256 reserve1)");
const id = (process.env.QUOTE_NETWORK ?? "testnet") as NetworkId;

/** Vitest hides console output of passing tests, so the report goes straight to stdout. */
function print(text: string): void {
  process.stdout.write(`${text}\n`);
}

function required(value: bigint | undefined, name: string): bigint {
  if (value === undefined) throw new Error(`Entered event without ${name}`);
  return value;
}

it(`quotes match every live Entered event on ${id}`, async () => {
  const network = networks[id];
  if (!network) throw new Error(`Unknown QUOTE_NETWORK "${id}" (use testnet or mainnet)`);
  const executor = network.executor;
  if (!executor) {
    print(`No executor on ${network.name} yet: nothing to check.`);
    return;
  }
  const a = network.addresses;
  const client = createPublicClient({ transport: http(network.rpcUrl) });
  const chainFee = await client.readContract({ address: executor.address, abi: mezoRouteExecutorAbi, functionName: "feeBps" });
  expect(chainFee, "the executor's on-chain fee differs from the pinned config").toBe(executor.feeBps);

  const head = await client.getBlockNumber();
  const events: EnteredEvent[] = [];
  for (let from = executor.deployBlock; from <= head; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n > head ? head : from + LOG_RANGE - 1n; // Mezo returns nothing past the head
    const logs = await client.getContractEvents({
      address: executor.address,
      abi: mezoRouteExecutorAbi,
      eventName: "Entered",
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      if (log.eventName !== "Entered") continue; // viem decodes whichever event the topic matches
      const e = log.args;
      events.push({
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        txHash: log.transactionHash,
        musdBorrowed: required(e.musdBorrowed, "musdBorrowed"),
        musdIn: required(e.musdIn, "musdIn"),
        fee: required(e.fee, "fee"),
        musdSwapped: required(e.musdSwapped, "musdSwapped"),
        btcFromSwap: required(e.btcFromSwap, "btcFromSwap"),
        musdAdded: required(e.musdAdded, "musdAdded"),
        btcAdded: required(e.btcAdded, "btcAdded"),
        liquidityOut: required(e.liquidityOut, "liquidityOut"),
        musdRefund: required(e.musdRefund, "musdRefund"),
        btcRefund: required(e.btcRefund, "btcRefund"),
      });
    }
  }

  const musdFirst = musdIsToken0(network);
  const poolAt = async (blockNumber: bigint): Promise<PoolState> => {
    const [reserves, totalSupply, feeBps] = await client.multicall({
      contracts: [
        { address: a.pool, abi: poolAbi, functionName: "getReserves" },
        { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
        { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
      ],
      blockNumber,
      allowFailure: false,
      multicallAddress: a.multicall3,
    });
    return {
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
      totalSupply,
      feeBps,
    };
  };

  const results: CheckResult[] = [];
  for (const event of events) {
    try {
      const syncs = await client.getLogs({ address: a.pool, event: SYNC, fromBlock: event.blockNumber, toBlock: event.blockNumber });
      if (earlierPoolActivity(syncs, event)) {
        results.push({ event, status: "skipped", reason: "same-block pool activity" });
        continue;
      }
      const pool = await poolAt(event.blockNumber - 1n);
      results.push({ event, status: "checked", check: checkEntry({ event, pool, feeBps: executor.feeBps, slippageBps: DEFAULT_SLIPPAGE }) });
    } catch (error) {
      results.push({ event, status: "skipped", reason: `pool state unavailable: ${(error as Error).message.split("\n")[0]}` });
    }
  }

  for (const r of results) {
    const columns = [
      r.event.blockNumber.toString(),
      `${r.event.txHash.slice(0, 10)}…`,
      `${(Number(r.event.musdIn) / 1e18).toString()} MUSD${r.event.musdBorrowed > 0n ? " (borrowed)" : ""}`,
      r.status === "skipped"
        ? `skipped: ${r.reason}`
        : [
            r.check.simulation.ok ? "simulation exact" : `simulation: ${r.check.simulation.mismatches.join("; ")}`,
            r.check.feeOk ? "fee ok" : "FEE MISMATCH",
            r.check.quote === null
              ? "no quote"
              : `${r.check.quote.optimal ? "optimal swap" : "caller's own swap"}, deviation ${r.check.quote.deviationBps} bps, ${r.check.quote.withinSlippage ? "within" : "OUTSIDE"} ${DEFAULT_SLIPPAGE} bps`,
          ].join(" · "),
    ];
    print(columns.join("  "));
  }
  const summary = summarise(results);
  print(JSON.stringify({ network: network.name, head: head.toString(), ...summary, maxDeviationBps: summary.maxDeviationBps.toString() }, null, 2));
  expect(summary.passed).toBe(true);
});
