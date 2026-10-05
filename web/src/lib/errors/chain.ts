import type { Hex } from "viem";

/**
 * One link of an error's cause chain. Wallets do not always throw Error instances (OrangeKit's
 * Xverse provider throws a plain `{ code, message }`), so links are read as plain objects.
 */
export type ChainLink = {
  name?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  code?: unknown;
  data?: unknown;
  raw?: unknown;
  cause?: unknown;
};

/** The error and its causes, outermost first, at most `maxDepth` links (cause chains can be cyclic). */
export function causeChain(error: unknown, maxDepth = 8): ChainLink[] {
  const chain: ChainLink[] = [];
  let current = error;
  while (typeof current === "object" && current !== null && chain.length < maxDepth) {
    chain.push(current as ChainLink);
    current = (current as ChainLink).cause;
  }
  return chain;
}

/** viem's `shortMessage`, `message`, and `details` (which holds the RPC's own text) of every link. */
export function chainMessages(chain: readonly ChainLink[]): string[] {
  const messages: string[] = [];
  for (const link of chain) {
    for (const value of [link.shortMessage, link.message, link.details]) {
      if (typeof value === "string" && value !== "") messages.push(value);
    }
  }
  return messages;
}

export function chainNames(chain: readonly ChainLink[]): string[] {
  return chain.map((link) => link.name).filter((name): name is string => typeof name === "string");
}

export function chainCodes(chain: readonly ChainLink[]): unknown[] {
  return chain.map((link) => link.code).filter((code) => code !== undefined);
}

// A 4-byte selector at least.
const REVERT_DATA = /^0x[0-9a-fA-F]{8,}$/;

/**
 * Revert data anywhere on the chain: viem keeps it on `raw` (ContractFunctionRevertedError, whose
 * `data` is the decoded object) or `data` (RpcRequestError, RawContractError), sometimes nested as
 * `data.data`.
 */
export function findRevertData(chain: readonly ChainLink[]): Hex | undefined {
  for (const link of chain) {
    const nested = typeof link.data === "object" && link.data !== null ? (link.data as { data?: unknown }).data : undefined;
    for (const candidate of [link.raw, link.data, nested]) {
      if (typeof candidate === "string" && REVERT_DATA.test(candidate)) return candidate as Hex;
    }
  }
  return undefined;
}
