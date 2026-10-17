import { decodeEventLog, erc20Abi, isAddressEqual, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import type { LogLike } from "@/lib/routes/musd-btc-lp/receipt";

/** What one Stability Pool call did, from its events only (FR-11). */
export type SpReceipt = {
  kind: "sp-deposit" | "sp-withdraw" | "sp-claim";
  depositor: Address;
  amount: bigint; // MUSD moved: in for a deposit, out for a withdrawal, 0 for a claim
  gain: bigint; // BTC paid to the depositor
  loss: bigint; // MUSD the deposit had absorbed since the previous action
  depositAfter: bigint;
};

// decodeEventLog throws on an unknown or missing topic; callers check `eventName` (it decodes any ABI event).
function decodePool(log: LogLike) {
  try {
    return decodeEventLog({ abi: stabilityPoolAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
  } catch {
    return null;
  }
}

function decodeToken(log: LogLike) {
  try {
    return decodeEventLog({ abi: erc20Abi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
  } catch {
    return null;
  }
}

/**
 * `UserDepositChanged` names the depositor (its indexed topic) and the deposit after the call;
 * `CollateralGainWithdrawn` the BTC gain and the loss. The MUSD `Transfer` between the depositor and
 * the pool tells a deposit from a withdrawal; a zero withdrawal sends no MUSD, so none means a claim.
 */
export function findSpReceipt(logs: readonly LogLike[], network: NetworkConfig): SpReceipt | null {
  const pool = network.addresses.stabilityPool;
  let depositor: Address | null = null;
  let depositAfter = 0n;
  let gain = 0n;
  let loss = 0n;
  for (const log of logs) {
    if (!isAddressEqual(log.address, pool)) continue;
    const decoded = decodePool(log);
    if (decoded?.eventName === "UserDepositChanged" && depositor === null) {
      depositor = decoded.args.depositor;
      depositAfter = decoded.args.newDeposit;
    }
    if (decoded?.eventName === "CollateralGainWithdrawn") {
      gain = decoded.args.collateral;
      loss = decoded.args.MUSDLoss;
    }
  }
  if (depositor === null) return null;
  for (const log of logs) {
    if (!isAddressEqual(log.address, network.addresses.musd)) continue;
    const decoded = decodeToken(log);
    if (decoded?.eventName !== "Transfer") continue;
    const { from, to, value } = decoded.args;
    if (isAddressEqual(from, depositor) && isAddressEqual(to, pool)) return { kind: "sp-deposit", depositor, amount: value, gain, loss, depositAfter };
    if (isAddressEqual(from, pool) && isAddressEqual(to, depositor)) return { kind: "sp-withdraw", depositor, amount: value, gain, loss, depositAfter };
  }
  return { kind: "sp-claim", depositor, amount: 0n, gain, loss, depositAfter };
}

const musd = (value: bigint) => `${formatToken(value)} MUSD`;
const btc = (value: bigint) => `${formatToken(value)} BTC`;

export function spReceiptRows(receipt: SpReceipt): { label: string; value: string }[] {
  const moved =
    receipt.kind === "sp-deposit"
      ? [{ label: "MUSD deposited", value: musd(receipt.amount) }]
      : receipt.kind === "sp-withdraw"
        ? [{ label: "MUSD withdrawn", value: musd(receipt.amount) }]
        : [];
  return [
    ...moved,
    { label: receipt.kind === "sp-claim" ? "BTC gain claimed" : "BTC gain paid", value: btc(receipt.gain) },
    { label: "Deposit loss realised", value: musd(receipt.loss) },
    { label: "Deposit now", value: musd(receipt.depositAfter) },
  ];
}
