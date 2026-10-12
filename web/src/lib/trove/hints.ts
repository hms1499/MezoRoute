import { zeroAddress, type Abi, type Address } from "viem";
import { hintHelpersAbi, sortedTrovesAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { isqrt } from "@/lib/math";

export type Hints = { upperHint: Address; lowerHint: Address; found: boolean };

/** Valid but costly: SortedTroves then walks the list from its head (≈2.18M gas on testnet, 2 Oct 2026). */
export const ZERO_HINTS: Hints = { upperHint: zeroAddress, lowerHint: zeroAddress, found: false };

/** Liquity's guidance for getApproxHint: 15 × √n trials, rounded up. */
export function hintTrials(troveCount: bigint): bigint {
  if (troveCount === 0n) return 0n;
  const root = isqrt(troveCount);
  return 15n * (root * root === troveCount ? root : root + 1n);
}

export type HintRead = (call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] }) => Promise<unknown>;

/** The Trove's insert position for its new NICR; zero hints on any failure (the send must not depend on it). */
export async function findHints(
  read: HintRead,
  input: { network: NetworkConfig; nicr: bigint; troveCount: bigint; seed: bigint },
): Promise<Hints> {
  if (input.troveCount === 0n) return ZERO_HINTS;
  const { hintHelpers, sortedTroves } = input.network.addresses;
  try {
    const [approx] = (await read({
      address: hintHelpers,
      abi: hintHelpersAbi,
      functionName: "getApproxHint",
      args: [input.nicr, hintTrials(input.troveCount), input.seed],
    })) as readonly [Address, bigint, bigint];
    const [upperHint, lowerHint] = (await read({
      address: sortedTroves,
      abi: sortedTrovesAbi,
      functionName: "findInsertPosition",
      args: [input.nicr, approx, approx],
    })) as readonly [Address, Address];
    return { upperHint, lowerHint, found: true };
  } catch {
    return ZERO_HINTS;
  }
}
