import { formatToken } from "@/lib/format";
import type { QueuePosition } from "./queue";

export const MAINNET_NOT_RUN = "Not yet run end to end on mainnet.";

export const RECOVERY_MODE_BLOCK =
  "Mezo is in Recovery Mode: the protocol does not allow withdrawing collateral or closing a Trove until the system ratio is back above 150%.";

export const EVM_ONLY =
  "Trove authorisations need an EVM wallet such as MetaMask. Bitcoin wallets can claim surplus BTC and repay from the wallet.";

/** Checked against TroveManager.redeemCollateral (mezo-org/musd, 7 Nov 2026): the redeemer pays the fee, not the borrower. */
export const REDEMPTION_EXPLAINER =
  "Redemptions start with the Troves that have the lowest collateral ratio above 110%. A redemption repays part of your debt with your BTC at Mezo's oracle price, so it undoes leverage rather than taking value at that price. If it closes your Trove, the BTC left over waits for you to claim it.";

export function queueLine(position: QueuePosition): string {
  const debt = formatToken(position.debtAhead, 18, 0);
  return `${debt} MUSD of debt would be redeemed before yours (${position.rank} of ${position.total}).`;
}

export const SURPLUS_CLAIM = "A redemption or liquidation closed your Trove and left BTC for you to claim.";
