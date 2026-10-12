import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { exitMinimums, quoteExit } from "@/lib/quote/exit";
import { NO_PERMIT } from "@/lib/routes/musd-btc-lp/params";
import { buildExitParams, encodeExitCall } from "./exit-params";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL } from "./test-fixtures";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49" as const;

describe("buildExitParams and encodeExitCall", () => {
  it("encodes exit(params, permit) with the quote's LP and minimums for the caller", () => {
    const quote = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_LIQUIDITY)!;
    const params = buildExitParams(quote, exitMinimums(quote, 100n), 1_790_904_300n, ME);
    expect(params).toEqual({
      liquidityIn: LIVE_EXIT_LIQUIDITY,
      minMusdRemoved: 19772283220635430652n,
      minBtcRemoved: 251046525692976n,
      minMusdFromSwap: 19764370461509400332n,
      minMusdOut: 39536653682144830984n,
      deadline: 1_790_904_300n,
      recipient: ME,
    });
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeExitCall(params) });
    expect(decoded.functionName).toBe("exit");
    expect(decoded.args).toEqual([params, NO_PERMIT]);
  });
});
