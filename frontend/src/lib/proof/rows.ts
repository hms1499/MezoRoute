import { decodeEventLog, type Address, type Hex } from "viem";
import { lpShort, musdShort } from "@/components/lp/units";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { mezoRouteLeverageAbi } from "@/lib/abi/mezoRouteLeverage";
import { formatToken } from "@/lib/format";
import type { ExplorerLog } from "@/lib/stability-pool/explorer";

// U19 Proof (spec §3.3): one row per MezoRoute action, built from the contracts' own events. Never from the explorer's
// transaction list: a Bitcoin wallet's call is relayed through its Safe, so our contract is reached by an internal call
// that list does not show, while the event is emitted all the same (with the Safe as `caller`).

/** One contract's logs; `contract` is its display name, e.g. "Executor V2". */
export type ProofSource = { contract: string; logs: readonly ExplorerLog[] };

export type ProofAction = "enter" | "borrowAndDeploy" | "enterFromBtc" | "exit" | "openLeveraged" | "leverage" | "unwind" | "close";

export type ProofRow = {
  key: string; // `${txHash}:${logIndex}`
  txHash: Hex;
  block: bigint;
  logIndex: number;
  time: bigint; // unix seconds, from the log's timeStamp
  action: ProofAction;
  staked: boolean;
  label: string;
  result: string;
  contract: string;
  wallet: Address;
  walletKind: "team" | "outside";
};

const btc6 = (value: bigint) => `${formatToken(value, 18, 6)} BTC`;

const LABELS: Record<ProofAction, string> = {
  enter: "Enter",
  borrowAndDeploy: "Borrow & Deploy",
  enterFromBtc: "Enter from BTC",
  exit: "Exit",
  openLeveraged: "Open with leverage",
  leverage: "Leverage",
  unwind: "Unwind",
  close: "Close",
};

type Decoded = { eventName: string; args: Record<string, unknown> };

function decode(log: ExplorerLog): Decoded | null {
  const topics = log.topics.filter((topic): topic is Hex => topic !== null);
  if (topics.length === 0) return null;
  for (const abi of [mezoRouteExecutorAbi, mezoRouteLeverageAbi]) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: topics as [Hex, ...Hex[]] });
      return { eventName: decoded.eventName, args: decoded.args as unknown as Record<string, unknown> };
    } catch {
      // Not this ABI's event; try the next one.
    }
  }
  return null;
}

/** The action and its result line; null for events that are not an action (Staked) or not ours. */
function describe(decoded: Decoded): { action: ProofAction; result: string; wallet: Address } | null {
  const a = decoded.args as Record<string, bigint> & { caller: Address; borrower: Address };
  // viem's decodeEventLog ignores `eventName` at runtime, so the name decides (AGENTS.md, F7).
  switch (decoded.eventName) {
    case "Entered": {
      const base = `${musdShort(a.musdIn)} → ${lpShort(a.liquidityOut)}`;
      return a.musdBorrowed > 0n
        ? { action: "borrowAndDeploy", result: `${base} · borrowed ${musdShort(a.musdBorrowed)}`, wallet: a.caller }
        : { action: "enter", result: base, wallet: a.caller };
    }
    case "EnteredFromBtc":
      return { action: "enterFromBtc", result: `${btc6(a.btcIn)} → ${lpShort(a.liquidityOut)}`, wallet: a.caller };
    case "Exited":
      return { action: "exit", result: `${lpShort(a.liquidityIn)} → ${musdShort(a.musdOut)}`, wallet: a.caller };
    case "OpenedLeveraged":
      return { action: "openLeveraged", result: `${btc6(a.btcFromUser)} in · borrowed ${musdShort(a.debtAmount)}`, wallet: a.borrower };
    case "Leveraged":
      return { action: "leverage", result: `+${btc6(a.btcAdded)} · +${musdShort(a.debtIncrease)} debt`, wallet: a.borrower };
    case "Unwound":
      return { action: "unwind", result: `repaid ${musdShort(a.debtRepaid)} · ${btc6(a.collWithdrawn)} out`, wallet: a.borrower };
    case "Closed":
      return { action: "close", result: `repaid ${musdShort(a.debtRepaid)} · ${btc6(a.collReturned)} back`, wallet: a.borrower };
    default:
      return null;
  }
}

/** Every action across `sources`, newest first; a Staked event marks its transaction's entry as staked. */
export function proofRows(sources: readonly ProofSource[], teamWallets: readonly Address[]): ProofRow[] {
  const team = new Set(teamWallets.map((wallet) => wallet.toLowerCase()));
  const stakedTxs = new Set<string>();
  const rows: Omit<ProofRow, "staked" | "label">[] = [];
  for (const source of sources) {
    for (const log of source.logs) {
      const decoded = decode(log);
      if (!decoded) continue;
      if (decoded.eventName === "Staked") {
        stakedTxs.add(log.transactionHash.toLowerCase());
        continue;
      }
      const described = describe(decoded);
      if (!described) continue;
      const logIndex = Number(BigInt(log.logIndex));
      rows.push({
        key: `${log.transactionHash}:${logIndex}`,
        txHash: log.transactionHash,
        block: BigInt(log.blockNumber),
        logIndex,
        time: log.timeStamp ? BigInt(log.timeStamp) : 0n,
        action: described.action,
        result: described.result,
        contract: source.contract,
        wallet: described.wallet,
        walletKind: team.has(described.wallet.toLowerCase()) ? "team" : "outside",
      });
    }
  }
  return rows
    .map((row) => {
      const staked = stakedTxs.has(row.txHash.toLowerCase());
      return { ...row, staked, label: staked ? `${LABELS[row.action]}, staked` : LABELS[row.action] };
    })
    .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : a.block < b.block ? 1 : -1));
}
