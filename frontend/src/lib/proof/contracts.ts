import type { Deployment, NetworkConfig } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";

// U19 Proof §3.3: the Contracts table comes from the config alone. The contracts are immutable, so their deployment,
// fee, and caps are constants; "Verified" is a constant too (all three are verified on both explorers, checked 13 Nov).

export type ProofContract = Deployment & { name: "Executor V2" | "Leverage" | "Executor V1"; role: string; terms: string };

const amount = (value: bigint) => formatToken(value, 18, 4);

export function proofContracts(network: NetworkConfig): ProofContract[] {
  const list: ProofContract[] = [];
  const { executor, leverage } = network;
  if (executor) {
    list.push({
      ...executor,
      name: "Executor V2",
      role: "LP route, stake, BTC entry",
      terms: `${executor.feeBps} bps · ${amount(network.entryCap)} MUSD or ${amount(network.entryCapBtc)} BTC`,
    });
  }
  if (leverage) {
    list.push({
      ...leverage,
      name: "Leverage",
      role: "Leverage, Unwind, Close",
      // Unwind and Close pay no fee (L1); only Leverage and Open do.
      terms: `${leverage.feeBps} bps on Leverage and Open · ${amount(leverage.maxMusdFlash)} MUSD or ${amount(leverage.maxBtcFlash)} BTC`,
    });
  }
  for (const legacy of network.legacyExecutors) {
    // V1 shares the entry cap and the 10 bps fee with V2 (Deploy.s.sol); it never took BTC.
    list.push({ ...legacy, name: "Executor V1", role: "Exit only, since V2", terms: `${executor?.feeBps ?? 10n} bps · ${amount(network.entryCap)} MUSD` });
  }
  return list.map(({ address, deployBlock, deployTx, deployedAt, name, role, terms }) => ({ address, deployBlock, deployTx, deployedAt, name, role, terms }));
}
