import { getAbiItem, type Address, type PublicClient } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { EnteredEvent, EnteredFromBtcEvent, ExitedEvent } from "@/lib/routes/musd-btc-lp/receipt";
import type { BlockRange, HistoryEvent } from "./history";

export type LogsClient = { getLogs: PublicClient["getLogs"] };

const ENTERED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Entered" });
const ENTERED_FROM_BTC = getAbiItem({ abi: mezoRouteExecutorAbi, name: "EnteredFromBtc" });
const EXITED = getAbiItem({ abi: mezoRouteExecutorAbi, name: "Exited" });

/**
 * The account's executor events in one range: LP minted to it (`Entered` and `EnteredFromBtc` by recipient;
 * the older executor has no BTC event, so that filter matches nothing there) and LP pulled from it (`Exited`
 * by caller), all filtered by indexed topics on the node.
 */
export async function readExecutorEvents(
  client: LogsClient,
  executor: Address,
  account: Address,
  range: BlockRange,
): Promise<HistoryEvent[]> {
  const [entered, enteredBtc, exited] = await Promise.all([
    client.getLogs({ address: executor, event: ENTERED, args: { recipient: account }, ...range }),
    client.getLogs({ address: executor, event: ENTERED_FROM_BTC, args: { recipient: account }, ...range }),
    client.getLogs({ address: executor, event: EXITED, args: { caller: account }, ...range }),
  ]);
  return [
    ...entered.map((log) => ({
      kind: "entered" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as EnteredEvent,
    })),
    ...enteredBtc.map((log) => ({
      kind: "enteredBtc" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as EnteredFromBtcEvent,
    })),
    ...exited.map((log) => ({
      kind: "exited" as const,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      event: log.args as ExitedEvent,
    })),
  ];
}
