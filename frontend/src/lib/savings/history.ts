import { savingsVaultAbi } from "@/lib/abi/savings";
import type { HistoryClient } from "@/lib/compare/history";
import type { NetworkConfig } from "@/lib/config/networks";

/** The vault's yieldIndex at F6's past block and at its head block (archive eth_call); rejects on any failure. */
export async function fetchSavingsIndexes(client: HistoryClient, network: NetworkConfig, pastBlock: bigint, headBlock: bigint): Promise<{ past: bigint; now: bigint }> {
  const vault = network.savingsVault;
  if (!vault) throw new Error("No savings vault on this network");
  const read = async (blockNumber: bigint) =>
    (
      await client.multicall({
        contracts: [{ address: vault.address, abi: savingsVaultAbi, functionName: "yieldIndex" }],
        blockNumber,
        allowFailure: false,
        multicallAddress: network.addresses.multicall3,
      })
    )[0] as bigint;
  const [past, now] = await Promise.all([read(pastBlock), read(headBlock)]);
  return { past, now };
}
