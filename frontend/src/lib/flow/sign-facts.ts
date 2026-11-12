import { REPOSITORY } from "@/lib/config/links";
import { explorerAddressUrl, type NetworkConfig } from "@/lib/config/networks";
import { formatBps, formatToken, shortAddress } from "@/lib/format";
import type { WalletKind } from "@/lib/wallet/capabilities";

// U14 §A: "Before you sign" on every flow page. What a person gives up the moment they sign, from values the page
// already read (the fee is the chain's, the block is the one every figure came from). Each list ends with Audit
// and Reads. These take no account: a wallet-less planner shows the same facts (U13).

export type SignFact = { label: string; value: string; href?: string };

const reads = (blockNumber: bigint): SignFact => ({ label: "Reads", value: `Block ${formatToken(blockNumber, 0, 0)}` });
const unaudited: SignFact = { label: "Audit", value: "Unaudited software", href: REPOSITORY };

/** The LP executor's facts; an exit charges no fee, and its approval replaces the entry cap. Null without an executor. */
export function lpSignFacts(
  network: NetworkConfig,
  input: { feeBps: bigint; capMusd: bigint | null; blockNumber: bigint; exit?: { walletKind: WalletKind } },
): SignFact[] | null {
  const executor = network.executor;
  if (!executor) return null;
  const third: SignFact = input.exit
    ? { label: "Approval", value: input.exit.walletKind === "smart-account" ? "Exact LP approval" : "LP permit (a signature)" }
    : { label: "Entry cap", value: `${formatToken(input.capMusd ?? 0n, 18, 0)} MUSD` };
  return [
    { label: "Executor", value: shortAddress(executor.address), href: explorerAddressUrl(network, executor.address) },
    { label: "MezoRoute fee", value: input.exit ? "None" : formatBps(input.feeBps) },
    third,
    unaudited,
    reads(input.blockNumber),
  ];
}

/**
 * The Stability Pool is Mezo's own contract, called directly: no MezoRoute fee and no MezoRoute code. A deposit
 * approves the exact amount; a withdraw or a claim moves MUSD and BTC out of the pool, so it needs no approval.
 */
export function spSignFacts(network: NetworkConfig, blockNumber: bigint, action: "deposit" | "withdraw" = "deposit"): SignFact[] {
  return [
    { label: "Contract", value: "Stability Pool", href: explorerAddressUrl(network, network.addresses.stabilityPool) },
    { label: "MezoRoute fee", value: "None" },
    { label: "Approval", value: action === "withdraw" ? "None needed" : "Exact amount" },
    { label: "Audit", value: "Mezo's contract; MezoRoute adds none" },
    reads(blockNumber),
  ];
}

/**
 * MezoRouteLeverage's facts (Open, Leverage, Unwind, Close). Null where it is not deployed. `repayOnly`: the page's
 * one action is Repay from wallet (Recovery Mode), a direct BorrowerOperations call with no fee and no signature.
 */
export function troveSignFacts(
  network: NetworkConfig,
  input: { feeBps: bigint; maxBtcFlash: bigint; maxMusdFlash: bigint; blockNumber: bigint; repayOnly?: boolean },
): SignFact[] | null {
  if (input.repayOnly) {
    return [
      { label: "Contract", value: "BorrowerOperations", href: explorerAddressUrl(network, network.addresses.borrowerOperations) },
      { label: "MezoRoute fee", value: "None" },
      { label: "Signatures", value: "None: a direct call from any wallet" },
      { label: "Audit", value: "Mezo's contract; MezoRoute adds none" },
      reads(input.blockNumber),
    ];
  }
  const leverage = network.leverage;
  if (!leverage) return null;
  return [
    { label: "Contract", value: "MezoRouteLeverage", href: explorerAddressUrl(network, leverage.address) },
    { label: "MezoRoute fee", value: formatBps(input.feeBps) },
    { label: "Per-transaction cap", value: `${formatToken(input.maxBtcFlash, 18, 4)} BTC / ${formatToken(input.maxMusdFlash, 18, 0)} MUSD` },
    { label: "Signatures", value: "Trove authorisation and permit (EVM wallets only)" },
    unaudited,
    reads(input.blockNumber),
  ];
}

/**
 * U17 §7: the amount card's one-line pointer at these facts below `lg`, where the aside sits far under the primary:
 * the route's own Audit fact, then its entry cap when it has one. It follows the list, so the Stability Pool (a direct
 * call to Mezo's contract) is never called unaudited MezoRoute software.
 */
export function trustLine(facts: SignFact[] | null): string | null {
  const audit = facts?.find((fact) => fact.label === "Audit");
  if (!audit) return null;
  const cap = facts?.find((fact) => fact.label === "Entry cap");
  return cap ? `${audit.value} · cap ${cap.value}` : audit.value;
}
