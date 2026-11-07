import { encodeErrorResult, ContractFunctionExecutionError, ContractFunctionRevertedError } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteLeverageAbi } from "@/lib/abi/mezoRouteLeverage";
import { networks } from "@/lib/config/networks";
import { decodeError } from "@/lib/errors/decode";
import { CLOSE_GAS, troveGasBudget } from "@/lib/quote/gas";

const revert = (errorName: string) => {
  const data = encodeErrorResult({ abi: mezoRouteLeverageAbi, errorName: errorName as never });
  const reverted = new ContractFunctionRevertedError({ abi: mezoRouteLeverageAbi, data, functionName: "close" });
  return new ContractFunctionExecutionError(reverted, { abi: mezoRouteLeverageAbi, functionName: "close", args: [] });
};

describe("L1 errors", () => {
  it("decodeError maps OracleBoundExceeded and PoolInputAboveMax to PRICE_MOVED", () => {
    for (const name of ["OracleBoundExceeded", "PoolInputAboveMax", "CollateralRatioTooLow"]) {
      expect(decodeError(revert(name), networks.testnet).kind).toBe("price-moved");
    }
  });

  it("maps the protocol's L1 revert strings", () => {
    expect(decodeError(new Error("execution reverted: BorrowerOps: Trove's net debt must be greater than minimum"), networks.testnet).kind).toBe("below-min-debt");
    expect(decodeError(new Error("execution reverted: BorrowerOps: Collateral withdrawal not permitted Recovery Mode"), networks.testnet).kind).toBe("recovery-mode");
    expect(decodeError(new Error("execution reverted: BorrowerOps: Caller doesnt have enough mUSD to make repayment"), networks.testnet).kind).toBe("insufficient-balance");
  });
});

describe("L1 gas", () => {
  it("mainnet budgets are testnet's × 1.3", () => {
    expect(troveGasBudget("close", networks.testnet)).toBe(CLOSE_GAS);
    expect(troveGasBudget("close", networks.mainnet)).toBe((CLOSE_GAS * 13n) / 10n);
  });
});
