import type { CreateWalletFn } from "@mezo-org/orangekit";
import type { CreateConnectorFn } from "wagmi";

type ConnectParameters = { chainId?: number; isReconnecting?: boolean } | undefined;
type Connector = ReturnType<CreateConnectorFn> & { connect(parameters?: ConnectParameters): Promise<unknown> };

/**
 * wagmi reconnects (after a reload) with `connect({ isReconnecting: true })` and no chainId, which
 * OrangeKit's connector rejects as an unsupported network, so wagmi dropped every Bitcoin wallet
 * on reload (found in F3 QA). This fills in the network's chain when the caller passes none.
 */
export function withReconnectChain(createWallet: CreateWalletFn, chainId: number): CreateWalletFn {
  return () => {
    const wallet = createWallet();
    return {
      ...wallet,
      createConnector: (details: Parameters<ReturnType<CreateWalletFn>["createConnector"]>[0]) => {
        const createConnector = wallet.createConnector(details) as unknown as (config: unknown) => Connector;
        return ((config: unknown) => {
          const connector = createConnector(config);
          const connect = connector.connect;
          return {
            ...connector,
            // A method, not an arrow: wagmi calls it on its own copy of the connector.
            connect(this: Connector, connectParameters?: ConnectParameters) {
              return connect.call(this, { ...connectParameters, chainId: connectParameters?.chainId ?? chainId });
            },
          };
        }) as unknown as ReturnType<typeof wallet.createConnector>;
      },
    };
  };
}
