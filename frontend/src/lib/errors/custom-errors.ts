import type { NetworkConfig } from "@/lib/config/networks";
import {
  aboveCap,
  ACCOUNT_CHANGED,
  ALLOWANCE,
  AMOUNT_TOO_SMALL,
  BORROW_MISMATCH,
  FEE_MISMATCH,
  INSUFFICIENT_BALANCE,
  POOL,
  QUOTE_EXPIRED,
  ROUTE_REFUSED,
  SLIPPAGE,
  STAKE_FAILED,
  STAKING_CLOSED,
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
  // The gauge stopped counting as alive between the quote and the send.
  NotAlive: STAKING_CLOSED,
  GaugeUnavailable: STAKING_CLOSED,
  StakeNotCredited: STAKE_FAILED,
  StakeIncomplete: STAKE_FAILED,
  LiquidityNotReceived: POOL,
  BorrowAmountMismatch: BORROW_MISMATCH,
  // The app always pays the caller, and the gauge only lets an account claim for itself: the wallet moved after the pin.
  NotBorrower: ACCOUNT_CHANGED,
  NotAuthorized: ACCOUNT_CHANGED,
  InvalidRecipient: ROUTE_REFUSED,
  ZeroAddress: ROUTE_REFUSED,
  UnexpectedBalanceDecrease: ROUTE_REFUSED,
  // Constructor checks: they only reach the app if it points at a bad deployment.
  FactoryMismatch: FEE_MISMATCH,
  PoolMismatch: FEE_MISMATCH,
  GaugeMismatch: FEE_MISMATCH,
  FeeTooHigh: FEE_MISMATCH,
};

export function customErrorOutcome(name: string, network: NetworkConfig): Outcome | null {
  if (!Object.hasOwn(BY_NAME, name)) return null;
  const entry = BY_NAME[name];
  return typeof entry === "function" ? entry(network) : entry;
}
