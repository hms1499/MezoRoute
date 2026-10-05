import { describe, expect, it } from "vitest";
import { isOrangeKitConnector, walletCapabilities, walletKind } from "./capabilities";

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

describe("walletKind when getCode failed", () => {
  it("reports an unknown kind for a non-OrangeKit wallet", () => {
    expect(walletKind({ connectorType: "injected", connectorId: "io.metamask", hasCode: undefined })).toBe("unknown");
  });

  it("still knows an OrangeKit connector is a smart account", () => {
    expect(walletKind({ connectorType: "orangekit", connectorId: "orangekit-unisat", hasCode: undefined })).toBe(
      "smart-account",
    );
  });
});

describe("isOrangeKitConnector", () => {
  it("matches by connector type or id prefix", () => {
    expect(isOrangeKitConnector({ type: "orangekit", id: "anything" })).toBe(true);
    expect(isOrangeKitConnector({ type: "injected", id: "orangekit-xverse" })).toBe(true);
    expect(isOrangeKitConnector({ type: "injected", id: "io.metamask" })).toBe(false);
  });
});

describe("walletCapabilities for an unknown kind", () => {
  it("uses the smart-account defaults: exact approvals, no Borrow & Deploy", () => {
    expect(walletCapabilities("unknown")).toEqual({ permit: false, borrowAndDeploy: false });
  });
});
