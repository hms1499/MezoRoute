import { describe, expect, it } from "vitest";
import { walletCapabilities, walletKind } from "./capabilities";

describe("walletKind", () => {
  it("treats an OrangeKit connector as a smart account before its Safe is deployed", () => {
    expect(walletKind({ connectorType: "orangekit", connectorId: "orangekit-unisat", hasCode: false })).toBe(
      "smart-account",
    );
  });

  it("treats an OrangeKit connector as a smart account after deployment", () => {
    expect(walletKind({ connectorType: "orangekit", connectorId: "orangekit-xverse", hasCode: true })).toBe(
      "smart-account",
    );
  });

  it("treats an injected wallet without code as an EOA", () => {
    expect(walletKind({ connectorType: "injected", connectorId: "io.metamask", hasCode: false })).toBe("eoa");
  });

  it("treats any other connector with deployed code as a smart account", () => {
    expect(walletKind({ connectorType: "walletConnect", connectorId: "walletConnect", hasCode: true })).toBe(
      "smart-account",
    );
  });
});

describe("walletCapabilities (spec FR-23)", () => {
  it("gives EOAs permits and Borrow & Deploy", () => {
    expect(walletCapabilities("eoa")).toEqual({ permit: true, borrowAndDeploy: true });
  });

  it("gives smart accounts neither", () => {
    expect(walletCapabilities("smart-account")).toEqual({ permit: false, borrowAndDeploy: false });
  });
});
