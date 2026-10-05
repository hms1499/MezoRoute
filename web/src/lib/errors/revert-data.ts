import { decodeErrorResult, parseAbi, type Abi, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { tigrisErrorsAbi } from "@/lib/abi/tigrisErrors";

// MUSD and BTC on Mezo may use either OpenZeppelin generation; OZ4 reverts with strings instead.
const ozErrorsAbi = parseAbi([
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
]);

/**
 * Every custom error the app's calls can revert with; viem adds Error(string) and Panic(uint256)
 * itself at runtime. Typed as plain `Abi` so `errorName` is a string that can be "Error" or "Panic".
 */
export const revertErrorsAbi: Abi = [
  ...mezoRouteExecutorAbi.filter((item) => item.type === "error"),
  ...tigrisErrorsAbi,
  ...ozErrorsAbi,
];

export type DecodedRevert =
  | { type: "custom"; name: string }
  | { type: "string"; reason: string }
  | { type: "unknown"; selector: Hex };

export function decodeRevertData(data: Hex): DecodedRevert {
  try {
    const { errorName, args } = decodeErrorResult({ abi: revertErrorsAbi, data });
    if (errorName === "Error") return { type: "string", reason: String(args?.[0] ?? "") };
    return { type: "custom", name: errorName };
  } catch {
    return { type: "unknown", selector: data.slice(0, 10) as Hex };
  }
}
