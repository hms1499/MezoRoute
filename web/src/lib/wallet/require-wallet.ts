export type WalletStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

/**
 * What `RequireWallet` renders. Only a reconnecting session (a reload with a remembered wallet) shows the
 * loading card. While the user connects through the modal, the fallback (the landing) stays behind it,
 * so cancelling the modal leaves the page as it was (U2 review).
 */
export function requireWalletView(status: WalletStatus, hasAddress: boolean): "loading" | "fallback" | "connected" {
  if (status === "reconnecting") return "loading";
  return status === "connected" && hasAddress ? "connected" : "fallback";
}
