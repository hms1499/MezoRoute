import type { CreateWalletFn } from "@mezo-org/orangekit";
import type { CreateConnectorFn } from "wagmi";

type ConnectParameters = { chainId?: number; isReconnecting?: boolean } | undefined;
type BitcoinProvider = { isInstalled(): boolean; setProvider(provider: unknown): void };
type Connector = ReturnType<CreateConnectorFn> & {
  icon?: string;
  connect(parameters?: ConnectParameters): Promise<unknown>;
  isAuthorized(): Promise<boolean>;
  getBitcoinProvider?(): BitcoinProvider;
};

/** How long a reload waits for the last-used wallet extension to inject its provider. */
const INJECTION_WAIT_MS = 2_000;
const INJECTION_POLL_MS = 100;

/** The injected provider OrangeKit reads for each wallet (Xverse needs OrangeKit's own wrapper, so none). */
function injectedProvider(connectorId: string): unknown {
  const page = globalThis.window as { unisat?: unknown; okxwallet?: { bitcoin?: unknown } } | undefined;
  if (connectorId === "orangekit-unisat") return page?.unisat;
  if (connectorId === "orangekit-okx") return page?.okxwallet?.bitcoin;
  return undefined;
}

async function waitForInjected(connectorId: string): Promise<unknown> {
  for (let waited = 0; ; waited += INJECTION_POLL_MS) {
    const provider = injectedProvider(connectorId);
    if (provider || waited >= INJECTION_WAIT_MS) return provider;
    await new Promise((resolve) => setTimeout(resolve, INJECTION_POLL_MS));
  }
}

/**
 * Makes OrangeKit's Bitcoin connectors survive wagmi's reconnect after a reload (found in F3 QA):
 * - wagmi calls `connect({ isReconnecting: true })` without a chainId, which OrangeKit rejects as an
 *   unsupported network; the network's chain is filled in.
 * - OrangeKit keeps the extension's provider from when the config was built, and `isAuthorized`
 *   (unlike `connect`) never looks again, so an extension that injects late was skipped; for the
 *   wallet used last it now waits briefly for the provider and hands it to the connector.
 * - OrangeKit's connector drops the `rkDetails` RainbowKit passes in, and its data-URI icon makes
 *   RainbowKit take it for an EIP-6963 wallet, listed under "Installed" whether or not the extension
 *   is there (U7). The details are put back with the connector's own name and icon; `installed` is
 *   left out, so every Bitcoin wallet stays clickable as before (RainbowKit hides one it thinks is absent).
 */
export function withReconnectChain(createWallet: CreateWalletFn, chainId: number): CreateWalletFn {
  return () => {
    const wallet = createWallet();
    return {
      ...wallet,
      createConnector: (details: Parameters<ReturnType<CreateWalletFn>["createConnector"]>[0]) => {
        const rkDetails = (details as { rkDetails?: Record<string, unknown> }).rkDetails;
        const createConnector = wallet.createConnector(details) as unknown as (config: unknown) => Connector;
        return ((config: { storage?: { getItem(key: string): unknown } | null }) => {
          const connector = createConnector(config);
          const { connect, isAuthorized } = connector;
          return {
            ...connector,
            ...(rkDetails && {
              rkDetails: { ...rkDetails, name: connector.name, iconUrl: connector.icon ?? rkDetails.iconUrl, installed: undefined },
            }),
            // Methods, not arrows: wagmi calls them on its own copy of the connector.
            connect(this: Connector, connectParameters?: ConnectParameters) {
              return connect.call(this, { ...connectParameters, chainId: connectParameters?.chainId ?? chainId });
            },
            async isAuthorized(this: Connector) {
              const bitcoinProvider = this.getBitcoinProvider?.();
              // Only the wallet used last is worth waiting for; the others answer at once.
              const lastUsed = (await config.storage?.getItem("recentConnectorId")) === this.id;
              if (bitcoinProvider && !bitcoinProvider.isInstalled() && lastUsed) {
                const injected = await waitForInjected(this.id);
                if (injected) bitcoinProvider.setProvider(injected);
              }
              return isAuthorized.call(this);
            },
          };
        }) as unknown as ReturnType<typeof wallet.createConnector>;
      },
    };
  };
}
