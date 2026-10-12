import { getAbiItem, type Address, type PublicClient } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { EnteredEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";
import type { BlockRange, HistoryEvent } from "./history";

export type LogsClient = { getLogs: PublicClient["getLogs"] };

const ENTERED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Entered" });
const EXITED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Exited" });

/**
 * The account's executor events in one range: LP minted to it (`Entered` by recipient) and LP pulled
 * from it (`Exited` by caller), both filtered by indexed topics on the node.
 */
export async function readExecutorEvents(
  client: LogsClient,
  executor: Address,
  account: Address,
  range: BlockRange,
): Promise<HistoryEvent[]> {
  const [entered, exited] = await Promise.all([
    client.getLogs({ address: executor, event: ENTERED, args: { recipient: account }, ...range }),
    client.getLogs({ address: executor, event: EXITED, args: { caller: account }, ...range }),
  ]);
  return [
    ...entered.map((log) => ({
      kind: "entered" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as EnteredEvent,
    })),
    ...exited.map((log) => ({
      kind: "exited" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as ExitedEvent,
    })),
  ];
}
