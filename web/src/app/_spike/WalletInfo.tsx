"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { testnet } from "@/lib/config/testnet";
import { walletCapabilities } from "@/lib/wallet/capabilities";
import { useWalletKind } from "./useWalletKind";

export function WalletInfo() {
  const { address, chainId, connector, status } = useAccount();
  const kind = useWalletKind();
  const { btcAddress } = useBitcoinAccount();
  const { data: gas } = useBalance({ address, query: { enabled: Boolean(address) } });

  if (status !== "connected" || !address) {
    return <p className="text-sm text-slate-600">Connect an EVM or Bitcoin wallet.</p>;
  }
  const caps = kind ? walletCapabilities(kind) : undefined;
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <dt>Connector</dt>
      <dd>
        {connector?.name} ({connector?.type}, {connector?.id})
      </dd>
      <dt>Mezo account</dt>
      <dd className="break-all font-mono">{address}</dd>
      <dt>Bitcoin address</dt>
      <dd className="break-all font-mono">{btcAddress ?? "—"}</dd>
      <dt>Chain</dt>
      <dd>
        {chainId}
        {chainId === testnet.chainId ? "" : " (wrong network)"}
      </dd>
      <dt>Wallet kind</dt>
      <dd>{kind ?? "detecting…"}</dd>
      <dt>Capabilities</dt>
      <dd>
        {caps
          ? `permit ${caps.permit ? "yes" : "no"}, Borrow & Deploy ${caps.borrowAndDeploy ? "yes" : "no"}`
          : "—"}
      </dd>
      <dt>BTC for gas</dt>
      <dd>{gas ? formatUnits(gas.value, gas.decimals) : "—"}</dd>
    </dl>
  );
}
