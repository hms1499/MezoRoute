import { REPOSITORY } from "@/lib/config/links";
import { explorerAddressUrl, type NetworkConfig } from "@/lib/config/networks";
import { formatBps, formatToken, shortAddress } from "@/lib/format";

// U14 §A: "Before you sign" on every flow page. What a person gives up the moment they sign, from values the page
// already read (the fee is the chain's, the block is the one every figure came from). Each list ends with Audit
// and Reads. These take no account: a wallet-less planner shows the same facts (U13).

export type SignFact = { label: string; value: string; href?: string };

const reads = (blockNumber: bigint): SignFact => ({ label: "Reads", value: `Block ${formatToken(blockNumber, 0, 0)}` });
const unaudited: SignFact = { label: "Audit", value: "Unaudited software", href: REPOSITORY };

/** The LP executor's facts; on exit the approval replaces the entry cap. Null without an executor. */
export function lpSignFacts(
  network: NetworkConfig,
  input: { feeBps: bigint; capMusd: bigint | null; blockNumber: bigint; exit?: { walletKind: "evm" | "smart" } },
): SignFact[] | null {
  const executor = network.executor;
  if (!executor) return null;
  const third: SignFact = input.exit
    ? { label: "Approval", value: input.exit.walletKind === "smart" ? "Exact LP approval" : "LP permit (a signature)" }
    : { label: "Entry cap", value: `${formatToken(input.capMusd ?? 0n, 18, 0)} MUSD` };
  return [
    { label: "Executor", value: shortAddress(executor.address), href: explorerAddressUrl(network, executor.address) },
    { label: "MezoRoute fee", value: formatBps(input.feeBps) },
    third,
    unaudited,
    reads(input.blockNumber),
  ];
}

/** The Stability Pool is Mezo's own contract, called directly: no MezoRoute fee and no MezoRoute code. */
export function spSignFacts(network: NetworkConfig, blockNumber: bigint): SignFact[] {
  return [
    { label: "Contract", value: "Stability Pool", href: explorerAddressUrl(network, network.addresses.stabilityPool) },
    { label: "MezoRoute fee", value: "None" },
    { label: "Approval", value: "Exact amount" },
    { label: "Audit", value: "Mezo's contract; MezoRoute adds none" },
    reads(blockNumber),
  ];
}

/** MezoRouteLeverage's facts (Open, Leverage, Unwind, Close). Null where it is not deployed. */
export function troveSignFacts(
  network: NetworkConfig,
  input: { feeBps: bigint; maxBtcFlash: bigint; maxMusdFlash: bigint; blockNumber: bigint },
): SignFact[] | null {
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
