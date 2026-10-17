import { describe, expect, it } from "vitest";
import { readExecutorEvents, type LogsClient } from "./history-reader";

const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";

describe("readExecutorEvents", () => {
  it("asks for Entered by recipient and Exited by caller, and tags each log", async () => {
    const calls: { event: string; args: unknown; fromBlock: unknown; toBlock: unknown }[] = [];
    const client = {
      getLogs: async (request: { event: { name: string }; args: unknown; fromBlock: bigint; toBlock: bigint }) => {
        calls.push({ event: request.event.name, args: request.args, fromBlock: request.fromBlock, toBlock: request.toBlock });
        return request.event.name === "Entered"
          ? [{ blockNumber: 7n, logIndex: 2, args: { liquidityOut: 1n } }]
          : [{ blockNumber: 9n, logIndex: 0, args: { liquidityIn: 1n } }];
      },
    } as unknown as LogsClient;

    const events = await readExecutorEvents(client, EXECUTOR, ME, { fromBlock: 1n, toBlock: 10n });
    expect(calls).toEqual([
      { event: "Entered", args: { recipient: ME }, fromBlock: 1n, toBlock: 10n },
      { event: "Exited", args: { caller: ME }, fromBlock: 1n, toBlock: 10n },
    ]);
    expect(events).toEqual([
      { kind: "entered", blockNumber: 7n, logIndex: 2, event: { liquidityOut: 1n } },
      { kind: "exited", blockNumber: 9n, logIndex: 0, event: { liquidityIn: 1n } },
    ]);
  });
});
