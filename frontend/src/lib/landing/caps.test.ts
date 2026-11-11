import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { contractLinks, mainnetCaps } from "./caps";

describe("mainnetCaps (U16)", () => {
  it("states the entry and Trove caps from the mainnet config", () => {
    expect(mainnetCaps(networks.mainnet)).toBe("1,000 MUSD or 0.0125 BTC per entry, 2,500 MUSD or 0.0125 BTC per Trove action");
  });

  it("leaves the Trove part out when the network has no Trove contract", () => {
    expect(mainnetCaps({ ...networks.mainnet, leverage: null })).toBe("1,000 MUSD or 0.0125 BTC per entry");
  });
});

describe("contractLinks (U16)", () => {
  it("lists the executor and the Trove contract", () => {
    expect(contractLinks(networks.mainnet)).toEqual([
      { label: "Executor contract", address: networks.mainnet.executor!.address },
      { label: "Trove contract", address: networks.mainnet.leverage!.address },
    ]);
  });

  it("skips a contract the network does not have", () => {
    expect(contractLinks({ ...networks.mainnet, leverage: null }).map((link) => link.label)).toEqual(["Executor contract"]);
    expect(contractLinks({ ...networks.mainnet, executor: null, leverage: null })).toEqual([]);
  });
});
