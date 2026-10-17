import { parseAbi } from "viem";

/** Multicall3's block reads; viem's `multicall3Abi` lacks `getBlockNumber`. */
export const multicall3BlockAbi = parseAbi([
  "function getBlockNumber() view returns (uint256 blockNumber)",
  "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
]);
