import { parseAbi } from "viem";

/** Tigris Router read used for the spike's swap quote (spec §11.1 Basic Router). */
export const routerAbi = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
]);
