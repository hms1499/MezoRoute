import { decodeFunctionData, zeroAddress, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteLeverageAbi } from "@/lib/abi/mezoRouteLeverage";
import { borrowerOperationsAbi } from "@/lib/abi/musd";
import { networks } from "@/lib/config/networks";
import { buildCloseCall, buildLeverageCall, buildOpenCall, buildUnwindCall, claimCollateralCall, refinanceCall, repayCall } from "./params";
import { quoteClose } from "./quote-close";
import { leverageQuoteAt } from "./quote-leverage";
import { quoteOpen } from "./quote-open";
import { quoteUnwind } from "./quote-unwind";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";

const network = networks.testnet;
const auth = { upperHint: zeroAddress, lowerHint: zeroAddress, signature: "0x1234" as const, deadline: 900n };
const permit = { value: 5n, deadline: 900n, v: 27, r: zeroHash, s: zeroHash };
const decode = (data: `0x${string}`) => decodeFunctionData({ abi: mezoRouteLeverageAbi, data });

describe("MezoRouteLeverage calls", () => {
  it("unwind carries the quote's repayment, withdrawal and maximum", () => {
    const q = quoteUnwind(trove(ONE, 40_000n * ONE), HARNESS_POOL, HARNESS_MARKET, 3n * ONE, 100n)!;
    const call = buildUnwindCall(network, q, auth, permit, 500n, 900n);
    expect(call.address).toBe(network.leverage!.address);
    expect(call.functionName).toBe("unwind");
    expect(call.args[0]).toEqual({ debtToRepay: q.debtToRepay, collWithdrawal: q.collWithdrawal, maxBtcToPool: q.maxBtcToPool, maxDeviationBps: 500n, deadline: 900n });
    expect(call.args[1]).toEqual(auth);
  });

  it("close carries the maximum BTC and no hints", () => {
    const q = quoteClose(trove(ONE, 40_000n * ONE), HARNESS_POOL, HARNESS_MARKET, 100n);
    const call = buildCloseCall(network, q, auth, permit, 500n, 900n);
    expect(call.args[0]).toEqual({ maxBtcToPool: q.maxBtcToPool, maxDeviationBps: 500n, deadline: 900n });
  });

  it("leverage signs the debt increase that covers the pool and the fee, with the CR floor", () => {
    const q = leverageQuoteAt(trove(ONE, 30_000n * ONE), HARNESS_POOL, HARNESS_MARKET, ONE / 5n, 100n, 10n);
    const call = buildLeverageCall(network, q, auth, permit, 2n * ONE, 500n, 900n);
    expect(call.args[0]).toEqual({ btcToAdd: ONE / 5n, debtIncrease: q.debtIncrease, maxMusdToPool: q.maxMusdToPool, minCollateralRatio: 2n * ONE, maxDeviationBps: 500n, deadline: 900n });
  });

  it("open sends the wallet's BTC as value", () => {
    const q = quoteOpen(ONE, HARNESS_POOL, HARNESS_MARKET, 2n * ONE, 100n, 10n, 12n * ONE)!;
    const call = buildOpenCall(network, q, auth, permit, 2n * ONE, 500n, 900n);
    expect(call.value).toBe(ONE);
    expect(call.functionName).toBe("openLeveraged");
    expect(call.args[0]).toMatchObject({ btcToFlash: q.btcToFlash, debtAmount: q.debtAmount });
  });

  it("every call encodes against the generated ABI", async () => {
    const { encodeFunctionData } = await import("viem");
    const q = quoteClose(trove(ONE, 40_000n * ONE), HARNESS_POOL, HARNESS_MARKET, 100n);
    const call = buildCloseCall(network, q, auth, permit, 500n, 900n);
    expect(decode(encodeFunctionData(call)).functionName).toBe("close");
  });
});

describe("direct protocol calls", () => {
  it("refinance, claimCollateral and repayMUSD go to BorrowerOperations", () => {
    expect(refinanceCall(network, auth)).toMatchObject({ address: network.addresses.borrowerOperations, abi: borrowerOperationsAbi, functionName: "refinance", args: [zeroAddress, zeroAddress] });
    expect(claimCollateralCall(network)).toMatchObject({ address: network.addresses.borrowerOperations, functionName: "claimCollateral", args: [] });
    expect(repayCall(network, 10n, auth)).toMatchObject({ functionName: "repayMUSD", args: [10n, zeroAddress, zeroAddress] });
  });
});
