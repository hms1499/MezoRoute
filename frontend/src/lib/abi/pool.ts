import { parseAbi } from "viem";

/** Tigris Pool: the pool contract is also the LP token (ERC20Permit), and it pays its swap fees on `claimFees`. */
export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function index0() view returns (uint256)",
  "function index1() view returns (uint256)",
  "function supplyIndex0(address account) view returns (uint256)",
  "function supplyIndex1(address account) view returns (uint256)",
  "function claimable0(address account) view returns (uint256)",
  "function claimable1(address account) view returns (uint256)",
  "function claimFees() returns (uint256 claimed0, uint256 claimed1)",
  "event Claim(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1)",
]);

/** Tigris PoolFactory: the swap fee in bps (testnet 4, mainnet 30). */
export const poolFactoryAbi = parseAbi(["function getFee(address pool, bool stable) view returns (uint256)"]);
