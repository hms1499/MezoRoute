import type { Address } from "viem";
import { troveManagerAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";

export type QueueEntry = { owner: Address; nicr: bigint; icr: bigint; debt: bigint };
export type QueuePosition = { debtAhead: bigint; rank: number; total: number };

/**
 * Where redemptions would reach the account. TroveManager.redeemCollateral starts at SortedTroves'
 * last (lowest NICR = coll / principal, interest left out), skips Troves under the MCR and walks up,
 * so the order is NICR, not ICR. `accountNicr` re-inserts the account after an action (or places a
 * Trove that does not exist yet); ties count as ahead.
 */
export function redemptionQueue(entries: QueueEntry[], account: Address, accountNicr: bigint | null, mcr: bigint): QueuePosition {
  const own = entries.find((e) => e.owner.toLowerCase() === account.toLowerCase());
  const nicr = accountNicr ?? own?.nicr ?? 0n;
  const others = entries.filter((e) => e.owner.toLowerCase() !== account.toLowerCase() && e.icr >= mcr);
  const ahead = others.filter((e) => e.nicr <= nicr);
  return {
    debtAhead: ahead.reduce((sum, e) => sum + e.debt, 0n),
    rank: ahead.length + 1,
    total: others.length + 1,
  };
}

export type MulticallRead = (contracts: readonly unknown[]) => Promise<readonly unknown[]>;

const PAGE = 100;

/** Every Trove's NICR, ICR and debt, in multicall pages of 100 (testnet has ≈ 370 Troves, mainnet 4). */
export async function readQueue(read: MulticallRead, network: NetworkConfig, price: bigint): Promise<QueueEntry[]> {
  const { chainId, addresses } = network;
  const tm = { chainId, address: addresses.troveManager, abi: troveManagerAbi } as const;
  const [count] = (await read([{ ...tm, functionName: "getTroveOwnersCount" }])) as [bigint];
  const owners: Address[] = [];
  for (let start = 0; start < Number(count); start += PAGE) {
    const indexes = Array.from({ length: Math.min(PAGE, Number(count) - start) }, (_, i) => BigInt(start + i));
    owners.push(...((await read(indexes.map((i) => ({ ...tm, functionName: "getTroveFromTroveOwnersArray", args: [i] })))) as Address[]));
  }
  const entries: QueueEntry[] = [];
  for (let start = 0; start < owners.length; start += PAGE) {
    const page = owners.slice(start, start + PAGE);
    const calls = page.flatMap((owner) => [
      { ...tm, functionName: "getNominalICR", args: [owner] },
      { ...tm, functionName: "getCurrentICR", args: [owner, price] },
      { ...tm, functionName: "getEntireDebtAndColl", args: [owner] },
    ]);
    const results = await read(calls);
    page.forEach((owner, i) => {
      const [, principal, interest] = results[i * 3 + 2] as readonly bigint[];
      entries.push({ owner, nicr: results[i * 3] as bigint, icr: results[i * 3 + 1] as bigint, debt: principal + interest });
    });
  }
  return entries;
}
