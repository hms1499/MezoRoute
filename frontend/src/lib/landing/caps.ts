import type { Address } from "viem";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";

const amount = (musd: bigint, btc: bigint) => `${formatToken(musd, 18, 0)} MUSD or ${formatToken(btc, 18, 8)} BTC`;

/** U16: every per-transaction cap the contracts enforce, from the config (never a literal), for the trust copy. */
export function mainnetCaps(network: NetworkConfig): string {
  const entry = `${amount(network.entryCap, network.entryCapBtc)} per entry`;
  if (!network.leverage) return entry;
  return `${entry}, ${amount(network.leverage.maxMusdFlash, network.leverage.maxBtcFlash)} per Trove action`;
}

export type ContractLink = { label: string; address: Address };

/** U16: the deployed MezoRoute contracts of a network, for the banner, footer and trust row. */
export function contractLinks(network: NetworkConfig): ContractLink[] {
  const links: ContractLink[] = [];
  if (network.executor) links.push({ label: "Executor contract", address: network.executor.address });
  if (network.leverage) links.push({ label: "Trove contract", address: network.leverage.address });
  return links;
}
