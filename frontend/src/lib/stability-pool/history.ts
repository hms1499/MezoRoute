import { decodeEventLog, getAbiItem, pad, toEventSelector, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { fetchAllLogs, type ExplorerLog, type FetchJson } from "./explorer";

type RowBase = { txHash: Hex; blockNumber: bigint; logIndex: number };
export type SpEventRow =
  | (RowBase & { kind: "deposit-changed"; newDeposit: bigint })
  | (RowBase & { kind: "gain-withdrawn"; collateral: bigint; musdLoss: bigint });

/**
 * One Stability Pool action of the depositor, rebuilt from its events: `before` is the compounded
 * deposit just before it (`previous newDeposit − MUSDLoss`), `amount` the MUSD added or removed.
 * An unchanged deposit is a claim (`withdrawFromSP(0)` or moving the gain to the Trove).
 */
export type SpAction = {
  kind: "deposit" | "withdraw" | "claim";
  txHash: Hex;
  blockNumber: bigint;
  amount: bigint;
  gain: bigint; // BTC paid out by this action
  loss: bigint; // MUSD the deposit had absorbed since the previous action
  before: bigint;
  depositAfter: bigint;
};

export const DEPOSIT_CHANGED_TOPIC = toEventSelector(getAbiItem({ abi: stabilityPoolAbi, name: "UserDepositChanged" }));
export const GAIN_WITHDRAWN_TOPIC = toEventSelector(getAbiItem({ abi: stabilityPoolAbi, name: "CollateralGainWithdrawn" }));

const toBigInt = (hex: string) => (hex === "0x" ? 0n : BigInt(hex));

export function decodeSpLog(log: ExplorerLog): SpEventRow | null {
  const topics = log.topics.filter((topic): topic is Hex => topic !== null);
  if (topics.length === 0) return null;
  const base = { txHash: log.transactionHash, blockNumber: toBigInt(log.blockNumber), logIndex: Number(toBigInt(log.logIndex)) };
  try {
    // decodeEventLog matches whichever ABI event the topic names, so check the name.
    const decoded = decodeEventLog({ abi: stabilityPoolAbi, topics: topics as [Hex, ...Hex[]], data: log.data });
    if (decoded.eventName === "UserDepositChanged") return { ...base, kind: "deposit-changed", newDeposit: decoded.args.newDeposit };
    if (decoded.eventName === "CollateralGainWithdrawn") {
      return { ...base, kind: "gain-withdrawn", collateral: decoded.args.collateral, musdLoss: decoded.args.MUSDLoss };
    }
    return null;
  } catch {
    return null;
  }
}

const chainOrder = (a: SpEventRow, b: SpEventRow) =>
  a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1;

/**
 * Actions in chain order. Each `UserDepositChanged` pairs with the `CollateralGainWithdrawn` logged
 * right next to it in the same transaction: after it for provideToSP/withdrawFromSP, before it for
 * withdrawCollateralGainToTrove. Pairing by adjacency keeps two calls in one transaction apart.
 */
export function spActions(rows: SpEventRow[]): SpAction[] {
  const sorted = [...rows].sort(chainOrder);
  const gains = sorted.filter((row): row is Extract<SpEventRow, { kind: "gain-withdrawn" }> => row.kind === "gain-withdrawn");
  let previous = 0n;
  const actions: SpAction[] = [];
  for (const row of sorted) {
    if (row.kind !== "deposit-changed") continue;
    const pair = gains.find(
      (gain) => gain.txHash.toLowerCase() === row.txHash.toLowerCase() && Math.abs(gain.logIndex - row.logIndex) === 1,
    );
    const loss = pair?.musdLoss ?? 0n;
    const before = previous > loss ? previous - loss : 0n;
    const delta = row.newDeposit - before;
    actions.push({
      kind: delta > 0n ? "deposit" : delta < 0n ? "withdraw" : "claim",
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      amount: delta < 0n ? -delta : delta,
      gain: pair?.collateral ?? 0n,
      loss,
      before,
      depositAfter: row.newDeposit,
    });
    previous = row.newDeposit;
  }
  return actions;
}

/** Both events of one depositor from the network's explorer API (two requests, paged if needed). */
export async function fetchSpHistoryRows(fetchJson: FetchJson, network: NetworkConfig, account: Address): Promise<SpEventRow[]> {
  const topic1 = pad(account.toLowerCase() as Address, { size: 32 });
  const address = network.addresses.stabilityPool;
  const [changed, gained] = await Promise.all([
    fetchAllLogs(fetchJson, network.explorerApiUrl, { address, topic0: DEPOSIT_CHANGED_TOPIC, topic1 }),
    fetchAllLogs(fetchJson, network.explorerApiUrl, { address, topic0: GAIN_WITHDRAWN_TOPIC, topic1 }),
  ]);
  return [...changed, ...gained].map(decodeSpLog).filter((row): row is SpEventRow => row !== null);
}
