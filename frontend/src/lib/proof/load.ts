import type { NetworkConfig } from "@/lib/config/networks";
import { fetchAllLogs, type FetchJson } from "@/lib/stability-pool/explorer";
import { proofContracts } from "./contracts";
import { proofRows, type ProofRow } from "./rows";

/**
 * Every action on the network's MezoRoute contracts, from each contract's deploy block (spec §3.3). Any contract whose
 * logs fail rejects the whole load: the page shows an error with Retry, never a silently shorter list.
 */
export async function loadProofRows(network: NetworkConfig, fetchJson: FetchJson): Promise<ProofRow[]> {
  const contracts = proofContracts(network);
  const sources = await Promise.all(
    contracts.map(async (contract) => ({
      contract: contract.name,
      logs: await fetchAllLogs(fetchJson, network.explorerApiUrl, { address: contract.address }, contract.deployBlock),
    })),
  );
  return proofRows(sources, network.teamWallets);
}
