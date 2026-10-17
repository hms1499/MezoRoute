import type { CreateWalletFn } from "@mezo-org/orangekit";
import type { CreateConnectorFn } from "wagmi";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("withReconnectChain: the wallet modal", () => {
  /** What RainbowKit hands createConnector: the wallet's list entry, from `connectorsForWallets`. */
  const rkDetails = {
    id: "orangekit-unisat",
    name: "OrangeKit Unisat",
    iconUrl: "https://www.svgrepo.com/show/74027/orange.svg",
    installed: false,
    groupName: "Bitcoin",
    groupIndex: 1,
    isRainbowKitConnector: true,
  };

  function modalConnector() {
    const createWallet = (() => ({
      ...rkDetails,
      createConnector: () => (() => ({ id: "orangekit-unisat", uid: "orangekit-unisat", name: "Unisat", icon: "data:image/svg+xml,unisat" })) as unknown as CreateConnectorFn,
    })) as unknown as CreateWalletFn;
    const create = withReconnectChain(createWallet, 31611)().createConnector({ rkDetails } as never) as unknown as (config: unknown) => {
      rkDetails?: Record<string, unknown>;
    };
    return create({});
  }

  it("keeps RainbowKit's details, so Bitcoin wallets list under Bitcoin, not as Installed EIP-6963 wallets", () => {
    expect(modalConnector().rkDetails).toMatchObject({ groupName: "Bitcoin", groupIndex: 1, isRainbowKitConnector: true });
  });

  it("shows the connector's own name and icon, and keeps every Bitcoin wallet clickable as before", () => {
    const details = modalConnector().rkDetails;
    expect(details).toMatchObject({ name: "Unisat", iconUrl: "data:image/svg+xml,unisat" });
    expect(details?.installed).toBeUndefined();
  });
});

describe("withReconnectChain: a wallet extension that injects after the config was built", () => {
  type Injected = { getAccounts(): Promise<string[]> };

  /** OrangeKit's connector keeps the injected provider it saw when the config was built. */
  function lateWallet(id: string, seen: Injected | undefined): CreateWalletFn {
    return (() => ({
      id,
      name: id,
      iconUrl: "",
      iconBackground: "",
      createConnector: () =>
        (() => {
          let provider = seen;
          const bitcoinProvider = {
            isInstalled: () => Boolean(provider),
            setProvider: (next: Injected) => {
              provider = next;
            },
          };
          return {
            id,
            getBitcoinProvider: () => bitcoinProvider,
            async isAuthorized() {
              if (!bitcoinProvider.isInstalled()) return false;
              return (await provider!.getAccounts()).length > 0;
            },
          };
        }) as unknown as CreateConnectorFn,
    })) as unknown as CreateWalletFn;
  }

  function authorizedOf(createWallet: CreateWalletFn, recentConnectorId = "orangekit-unisat") {
    const createConnector = createWallet().createConnector({} as never) as unknown as (config: unknown) => {
      isAuthorized(): Promise<boolean>;
    };
    const storage = { getItem: async (key: string) => (key === "recentConnectorId" ? recentConnectorId : null) };
    return createConnector({ storage }).isAuthorized();
  }

  const unisat: Injected = { getAccounts: async () => ["tb1qcjzphr67dug28rw9ueewrqllmxlqe5f0v7g34m"] };

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { window?: unknown }).window;
  });

  it("picks up Unisat once it appears, so a reload keeps the wallet", async () => {
    vi.useFakeTimers();
    const window: { unisat?: Injected } = {};
    (globalThis as { window?: unknown }).window = window;
    const authorized = authorizedOf(withReconnectChain(lateWallet("orangekit-unisat", undefined), 31611));
    setTimeout(() => {
      window.unisat = unisat;
    }, 300);
    await vi.advanceTimersByTimeAsync(400);
    await expect(authorized).resolves.toBe(true);
  });

  it("gives up after a short wait when the extension is not installed", async () => {
    vi.useFakeTimers();
    (globalThis as { window?: unknown }).window = {};
    const authorized = authorizedOf(withReconnectChain(lateWallet("orangekit-unisat", undefined), 31611));
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(authorized).resolves.toBe(false);
  });

  it("does not wait for a wallet that was not the last one used", async () => {
    vi.useFakeTimers();
    (globalThis as { window?: unknown }).window = {};
    const authorized = authorizedOf(withReconnectChain(lateWallet("orangekit-okx", undefined), 31611));
    await vi.advanceTimersByTimeAsync(0);
    await expect(authorized).resolves.toBe(false);
  });

  it("does not wait when the provider was already there", async () => {
    (globalThis as { window?: unknown }).window = {};
    await expect(authorizedOf(withReconnectChain(lateWallet("orangekit-unisat", unisat), 31611))).resolves.toBe(true);
  });
});
