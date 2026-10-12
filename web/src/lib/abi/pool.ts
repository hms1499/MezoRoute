import { parseAbi } from "viem";

/** Tigris Pool reads: the pool contract is also the LP token. */
export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

/** Tigris PoolFactory: the swap fee in bps (testnet 4, mainnet 30). */
export const poolFactoryAbi = parseAbi(["function getFee(address pool, bool stable) view returns (uint256)"]);
