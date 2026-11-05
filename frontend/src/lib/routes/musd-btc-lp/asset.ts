import type { NetworkConfig } from "@/lib/config/networks";
import type { BalanceAction } from "@/lib/routes/balance-recovery";
import type { EntryMode } from "./intent";

/** What the user puts in: MUSD (V1 and V2 `enter`) or BTC (V2 `enterFromBtc`). */
export type EntryAsset = "musd" | "btc";

/** `asset=btc` selects BTC; Borrow & Deploy always brings MUSD, so borrow mode hides the BTC asset. */
export function parseEntryAsset(param: string | null, mode: EntryMode): EntryAsset {
  return param === "btc" && mode !== "borrow" ? "btc" : "musd";
}

/**
 * The BTC that stays in the wallet to pay for the entry: four times its gas units at the current gas price (Ruling
 * P17). MetaMask on Mezo mainnet sets a limit of 3 x the RPC estimate and a wallet needs balance >= limit x price
 * + value, so the budget x 4 covers that limit (3 x the highest healthy estimate is below 3 x the budget) with room.
 * BTC is both the asset and the gas, so spending the whole balance would leave the send unpayable. The gas price
 * must be known: without it the caller blocks the entry (Ruling P18) instead of reserving nothing.
 */
export function btcGasReserve(gasUnits: bigint, gasPrice: bigint): bigint {
  return gasUnits * 4n * gasPrice;
}

/** What "Use my balance" and Max may enter: the balance less the gas reserve, never below 0. */
export function maxBtcSpendable(balance: bigint, gasReserve: bigint): bigint {
  return balance > gasReserve ? balance - gasReserve : 0n;
}

/** The most a BTC entry can take: the spendable balance, limited by the executor's cap. */
export function spendableCap(balance: bigint, gasReserve: bigint, cap: bigint): bigint {
  const spendable = maxBtcSpendable(balance, gasReserve);
  return spendable < cap ? spendable : cap;
}

/**
 * The ways out of "Amount exceeds your available BTC": the spendable balance (capped by the executor), or
 * where to get BTC when nothing is spendable (the faucet on testnet, the Mezo app otherwise).
 */
export function btcRecoveries(input: {
  amount: bigint;
  walletBtc: bigint;
  reserve: bigint;
  cap: bigint;
  network: NetworkConfig;
}): BalanceAction[] {
  const spendable = maxBtcSpendable(input.walletBtc, input.reserve);
  if (spendable === 0n) return [{ kind: "get-btc", href: input.network.faucetUrl ?? input.network.mezoAppUrl }];
  return input.cap < spendable ? [{ kind: "use-balance", amount: input.cap, capped: true }] : [{ kind: "use-balance", amount: spendable }];
}
