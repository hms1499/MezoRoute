import { explorerTxUrl, type NetworkConfig } from "@/lib/config/networks";
import type { SignFact } from "@/lib/flow/sign-facts";
import { formatToken, shortAddress } from "@/lib/format";

/**
 * The receipt's aside (U14): which transaction this is. Before the receipt arrives only the hash is known; after it,
 * the block, the gas used, and what the gas cost (gas used × the effective gas price, in BTC).
 */
export function txRows(
  receipt: { transactionHash: string; blockNumber?: bigint; gasUsed?: bigint; effectiveGasPrice?: bigint },
  network: NetworkConfig,
): SignFact[] {
  const rows: SignFact[] = [
    { label: "Transaction", value: shortAddress(receipt.transactionHash), href: explorerTxUrl(network, receipt.transactionHash) },
  ];
  if (receipt.blockNumber === undefined || receipt.gasUsed === undefined) return rows;
  rows.push({ label: "Block", value: formatToken(receipt.blockNumber, 0, 0) }, { label: "Gas used", value: formatToken(receipt.gasUsed, 0, 0) });
  if (receipt.effectiveGasPrice !== undefined) {
    rows.push({ label: "Network fee", value: `${formatToken(receipt.gasUsed * receipt.effectiveGasPrice, 18, 8)} BTC` });
  }
  return rows;
}
