import type { TroveAction } from "./intent";

// U17 §7: what each Trove action does, for the page a visitor sees before a wallet connects. The flash actions sign a
// Trove authorisation and a permit, which Bitcoin wallets (OrangeKit Safes) cannot, so each says who it is for.

export const TROVE_CONNECT: Record<TroveAction, string> = {
  unwind: "Repay part of your debt from your own BTC collateral in one transaction, raising your collateral ratio. EVM wallets only.",
  close: "Repay all your debt from your BTC collateral and get the rest back, in one transaction. EVM wallets only.",
  leverage: "Borrow more MUSD and add it to your Trove as BTC in one transaction, lowering your collateral ratio. EVM wallets only.",
  open: "Open a Trove and lever it to your target ratio in one transaction. EVM wallets only.",
};
