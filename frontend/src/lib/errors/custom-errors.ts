import type { NetworkConfig } from "@/lib/config/networks";
import {
  aboveCap,
  ALLOWANCE,
  AMOUNT_TOO_SMALL,
  INSUFFICIENT_BALANCE,
  POOL,
  QUOTE_EXPIRED,
  SLIPPAGE,
} from "./outcomes";
import type { Outcome } from "./types";

/** Custom errors of the executor, the Tigris Router and Pool, and OZ5 ERC-20, by name. */
const BY_NAME: Record<string, Outcome | ((network: NetworkConfig) => Outcome)> = {
  // Deadline passed (the executor and the Router share the selector).
  Expired: QUOTE_EXPIRED,
  InsufficientSwapOutput: SLIPPAGE,
  InsufficientLiquidityOutput: SLIPPAGE,
  InsufficientFinalOutput: SLIPPAGE,
  InsufficientOutputAmount: SLIPPAGE,
  InsufficientAmount: SLIPPAGE,
  InsufficientAmountA: SLIPPAGE,
  InsufficientAmountB: SLIPPAGE,
  AmountAboveCap: aboveCap,
  InvalidSwapAmount: AMOUNT_TOO_SMALL,
  ZeroAmount: AMOUNT_TOO_SMALL,
  ERC20InsufficientAllowance: ALLOWANCE,
  ERC20InsufficientBalance: INSUFFICIENT_BALANCE,
  K: POOL,
  InsufficientLiquidity: POOL,
  InsufficientLiquidityMinted: POOL,
  InsufficientLiquidityBurned: POOL,
  IsPaused: POOL,
};

export function customErrorOutcome(name: string, network: NetworkConfig): Outcome | null {
  if (!Object.hasOwn(BY_NAME, name)) return null;
  const entry = BY_NAME[name];
  return typeof entry === "function" ? entry(network) : entry;
}
