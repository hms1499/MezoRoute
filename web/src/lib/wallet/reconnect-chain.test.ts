import type { CreateWalletFn } from "@mezo-org/orangekit";
import type { CreateConnectorFn } from "wagmi";
import { describe, expect, it } from "vitest";
import { withReconnectChain } from "./reconnect-chain";

type ConnectCall = { parameters: unknown; self: unknown };

/** A stand-in for an OrangeKit wallet whose connector records how wagmi called connect(). */
function fakeWallet(calls: ConnectCall[]): CreateWalletFn {
  return (() => ({
    id: "orangekit-unisat",
    name: "Unisat",
    iconUrl: "",
    iconBackground: "",
    createConnector: () =>
      (() => ({
        id: "orangekit-unisat",
        async connect(this: unknown, parameters: unknown) {
          calls.push({ parameters, self: this });
          return { accounts: [], chainId: 31611 };
        },
      })) as unknown as CreateConnectorFn,
  })) as unknown as CreateWalletFn;
}

function connectorOf(createWallet: CreateWalletFn) {
  const wallet = createWallet();
  const createConnector = wallet.createConnector({} as never) as unknown as (config: unknown) => {
    connect(parameters?: unknown): Promise<unknown>;
  };
  return createConnector({});
}

describe("withReconnectChain", () => {
  it("gives wagmi's reconnect, which passes no chainId, the network's chain", async () => {
    const calls: ConnectCall[] = [];
    await connectorOf(withReconnectChain(fakeWallet(calls), 31611)).connect({ isReconnecting: true });
    expect(calls[0].parameters).toEqual({ isReconnecting: true, chainId: 31611 });
  });

  it("keeps an explicit chainId and handles a call without parameters", async () => {
    const calls: ConnectCall[] = [];
    const connector = connectorOf(withReconnectChain(fakeWallet(calls), 31611));
    await connector.connect({ chainId: 31612 });
    await connector.connect();
    expect(calls.map((call) => call.parameters)).toEqual([{ chainId: 31612 }, { chainId: 31611 }]);
  });

  it("calls the original connect on the connector wagmi uses, so `this` still has its methods", async () => {
    const calls: ConnectCall[] = [];
    const connector = connectorOf(withReconnectChain(fakeWallet(calls), 31611));
    const used = { ...connector, uid: "wagmi-uid" };
    await used.connect({});
    expect(calls[0].self).toBe(used);
  });
});
