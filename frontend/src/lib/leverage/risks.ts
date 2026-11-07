import type { TroveAction } from "./intent";

const SWAP_AT_POOL = "The swap uses the MUSD/BTC pool's price, which can differ from Mezo's oracle; the cost against the oracle is shown above.";
const ONE_TRANSACTION = "Everything happens in one transaction: if any step fails, nothing changes.";

/**
 * The full risk list on each Confirm page (static lines; the page puts the redemption-queue figure
 * first for Leverage and Open). Never promises a return.
 */
export function troveRisks(action: TroveAction): string[] {
  switch (action) {
    case "unwind":
      return [
        "Unwinding sells part of your collateral to repay debt; your BTC exposure falls by the BTC sold.",
        SWAP_AT_POOL,
        "Withdrawing collateral also lowers your Trove's borrowing capacity until you refinance.",
        ONE_TRANSACTION,
      ];
    case "close":
      return [
        "Closing sells enough of your collateral to repay the whole debt; the rest of your BTC returns to your wallet.",
        SWAP_AT_POOL,
        "The 200 MUSD gas compensation is settled by the protocol; you do not need MUSD in your wallet.",
        ONE_TRANSACTION,
      ];
    case "leverage":
      return [
        "Leverage adds BTC to your Trove with borrowed MUSD: if BTC falls, your collateral ratio falls faster.",
        "A lower collateral ratio moves your Trove closer to the front of the redemption queue and to liquidation at 110%.",
        SWAP_AT_POOL,
        "MezoRoute charges 10 bps on the MUSD paid to the pool; Mezo adds its borrowing fee to your debt.",
        ONE_TRANSACTION,
      ];
    case "open":
      return [
        "Opening at leverage borrows MUSD to buy extra BTC for the new Trove: if BTC falls, your collateral ratio falls faster.",
        "A Trove needs at least 1,800 MUSD of debt; MUSD beyond what the pool needs stays in your wallet, still owed.",
        "A low collateral ratio puts your Trove near the front of the redemption queue and closer to liquidation at 110%.",
        SWAP_AT_POOL,
        "MezoRoute charges 10 bps on the MUSD paid to the pool; Mezo adds its borrowing fee to your debt.",
        ONE_TRANSACTION,
      ];
  }
}
