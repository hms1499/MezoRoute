import type { NetworkConfig } from "@/lib/config/networks";
import { formatPercent, formatToken } from "@/lib/format";
import { AT_RISK_DROP_PERCENT, CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { borrowHeadroom, collateralRatio, troveHealth, type TroveHealth } from "@/lib/trove/health";
import type { WalletKind } from "@/lib/wallet/capabilities";
import type { DashboardSnapshot } from "./snapshot";

/** Gas units the heaviest flow needs (approve + borrowAndEnter), with margin. */
export const GAS_BUDGET = 3_000_000n;
/** Below 1 MUSD the wallet has nothing worth routing. */
export const MIN_USABLE_MUSD = 10n ** 18n;

export type ReadinessState = "needs-gas" | "ready" | "can-borrow" | "borrow-in-mezo" | "no-room" | "no-trove";
export type Readiness = { state: ReadinessState; borrowable: bigint; health: TroveHealth | null };

/** The dashboard's one readiness state (PRODUCT_SPEC §7 Flow A); the first matching state wins. */
export function readiness(input: {
  snapshot: DashboardSnapshot;
  gasBalance: bigint;
  gasPrice: bigint | undefined;
  walletKind: WalletKind;
}): Readiness {
  const { snapshot, gasBalance, gasPrice, walletKind } = input;
  const { trove, price, protocol, musd } = snapshot;
  const borrowable = trove ? borrowHeadroom(trove, price, protocol) : 0n;
  const health = trove ? troveHealth(collateralRatio(trove, price), protocol.mcr) : null;
  // An empty wallet can never pay; an unknown gas price trusts any non-zero balance.
  const needsGas = gasBalance === 0n || (gasPrice !== undefined && gasBalance < gasPrice * GAS_BUDGET);

  let state: ReadinessState;
  if (needsGas) state = "needs-gas";
  else if (musd >= MIN_USABLE_MUSD) state = "ready";
  else if (borrowable >= MIN_USABLE_MUSD) state = walletKind === "eoa" ? "can-borrow" : "borrow-in-mezo";
  else if (trove) state = "no-room";
  else state = "no-trove";
  return { state, borrowable, health };
}

export type ReadinessCopy = {
  tone: "positive" | "attention" | "neutral";
  tag: string;
  headline: string;
  detail?: string;
  action?: { label: string; href: string };
};

const musdAmount = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

export function readinessCopy(
  readiness: Readiness,
  context: { musd: bigint; walletKind: WalletKind; network: NetworkConfig },
): ReadinessCopy {
  const { musd, walletKind, network } = context;
  const mezoApp = { label: "Open Mezo app", href: network.mezoAppUrl };
  const room = musdAmount(readiness.borrowable);
  switch (readiness.state) {
    case "needs-gas":
      return {
        tone: "attention",
        tag: "Needs gas",
        headline: "You need BTC on Mezo to pay for transactions.",
        action: network.faucetUrl ? { label: "Get test BTC", href: network.faucetUrl } : mezoApp,
      };
    case "ready":
      return {
        tone: "positive",
        tag: "Ready",
        headline: `You have ${musdAmount(musd)} ready to deploy.`,
        ...(walletKind === "eoa" && readiness.borrowable >= MIN_USABLE_MUSD
          ? { detail: `You can also borrow up to ${room}.` }
          : {}),
      };
    case "can-borrow":
      return {
        tone: "positive",
        tag: "Can borrow",
        headline: `Borrow up to ${room} against your Trove and deploy it in one transaction.`,
      };
    case "borrow-in-mezo":
      return {
        tone: "positive",
        tag: "Can borrow",
        headline: `Your Trove can borrow up to ${room}.`,
        detail: "Borrow it in the Mezo app first; Borrow & Deploy needs a standard wallet signature.",
        action: mezoApp,
      };
    case "no-room":
      return {
        tone: "neutral",
        tag: "No MUSD",
        headline: `Your Trove has no room to borrow above a ${formatPercent(CR_SAFETY_FLOOR, 0)} collateral ratio.`,
        detail: "Add collateral in the Mezo app.",
        action: mezoApp,
      };
    case "no-trove":
      return {
        tone: "neutral",
        tag: "No MUSD",
        headline: "You need MUSD to start.",
        detail: "Open a Trove in the Mezo app to borrow MUSD against BTC.",
        action: mezoApp,
      };
  }
}

export type TroveWarning = { tone: "warning" | "danger"; message: string };

/** The persistent banner above the dashboard; it never blocks using wallet MUSD (Flow A). */
export function troveWarning(health: TroveHealth | null, mcr: bigint): TroveWarning | null {
  if (health === "liquidatable") {
    return { tone: "danger", message: `Your Trove is below the ${formatPercent(mcr, 0)} minimum and can be liquidated.` };
  }
  if (health === "at-risk") {
    return {
      tone: "warning",
      message: `Your Trove is at risk: a ${AT_RISK_DROP_PERCENT}% BTC drop would make it liquidatable. Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.`,
    };
  }
  return null;
}
