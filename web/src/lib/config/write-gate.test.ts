import { describe, expect, it } from "vitest";
import { networks } from "./networks";
import { writeBlocker, writeBlockerMessage } from "./write-gate";

describe("writeBlocker (spec FR-01)", () => {
  it("allows writes on the configured chain when an executor exists", () => {
    expect(writeBlocker(networks.testnet, 31611)).toBeNull();
  });

  it.each([1, 31612, undefined])("blocks writes from chain %s on testnet", (chainId) => {
    expect(writeBlocker(networks.testnet, chainId)).toBe("wrong-network");
  });

  it("reports the missing executor before the chain", () => {
    expect(writeBlocker(networks.mainnet, 31612)).toBe("no-executor");
    expect(writeBlocker(networks.mainnet, 1)).toBe("no-executor");
  });
});

describe("writeBlockerMessage", () => {
  it("explains each blocker", () => {
    expect(writeBlockerMessage("no-executor", networks.mainnet)).toBe("Mainnet actions open after launch. Reading only.");
    expect(writeBlockerMessage("wrong-network", networks.testnet)).toBe("MezoRoute executes on Mezo Testnet.");
    expect(writeBlockerMessage("wrong-network", networks.mainnet)).toBe("MezoRoute executes on Mezo Mainnet.");
  });
});
