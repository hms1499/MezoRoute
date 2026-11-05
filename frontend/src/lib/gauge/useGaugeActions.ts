"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { erc20Abi, type Address } from "viem";
import { useConfig } from "wagmi";
import { getAccount, readContract, simulateContract } from "wagmi/actions";
import { useErrorToast } from "@/components/ErrorToast";
import { gaugeAbi } from "@/lib/abi/gauge";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { APPROVE_GAS, GAUGE_CLAIM_GAS, GAUGE_DEPOSIT_GAS, GAUGE_WITHDRAW_GAS } from "@/lib/quote/gas";
import { encodeApproveCall, needsApproval } from "@/lib/routes/musd-btc-lp/params";
import { BlockedError } from "@/lib/tx/errors";
import { sendCall, submitCall, type SendPin } from "@/lib/tx/send";
import { encodeGaugeCall, gaugeActionBlock, type GaugeAction } from "./actions";

/**
 * Direct gauge calls from Positions: claim MEZO, stake all wallet LP (an exact LP approval first when the
 * gauge's allowance is short), unstake all. Each send re-reads the snapshot, re-gates, simulates (a
 * revert is decoded and nothing is sent), submits with a measured budget, and hands the hash to the
 * receipt page. The amounts come from the fresh snapshot, so "all" means all at send time.
 */
export function useGaugeActions(account: Address): {
  claim: () => void;
  stakeAll: () => void;
  unstakeAll: () => void;
  pending: GaugeAction | null;
} {
  const config = useConfig();
  const { network } = useNetwork();
  const router = useRouter();
  const { showError } = useErrorToast();
  const { refresh } = usePositionsSnapshot(account);
  const [pending, setPending] = useState<GaugeAction | null>(null);

  async function send(action: GaugeAction) {
    const pin: SendPin = { account, chainId: network.chainId };
    setPending(action);
    try {
      const gauge = network.gauge?.address;
      const fresh = await refresh();
      const state = fresh.snapshot.gauge;
      if (!gauge || !state) throw new Error("This network has no gauge");
      const walletLp = fresh.snapshot.lpBalance;
      const block = gaugeActionBlock({
        network,
        walletChainId: getAccount(config).chainId,
        action,
        state,
        walletLp,
        lacksGas: lacksGas(fresh.gasBalance, fresh.gasPrice),
      });
      if (block) throw new BlockedError(block.outcome);

      const common = { address: gauge, abi: gaugeAbi, account: pin.account, chainId: pin.chainId } as const;
      if (action === "claim") {
        await simulateContract(config, { ...common, functionName: "getReward", args: [account] });
        const data = encodeGaugeCall({ action, account });
        router.push(`/tx/?hash=${await submitCall(config, { to: gauge, data }, pin, GAUGE_CLAIM_GAS)}`);
      } else if (action === "stake") {
        const allowance = await readContract(config, {
          address: network.addresses.pool,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, gauge],
          chainId: pin.chainId,
        });
        if (needsApproval(allowance, walletLp)) {
          await sendCall(config, { to: network.addresses.pool, data: encodeApproveCall(gauge, walletLp) }, pin, APPROVE_GAS);
        }
        await simulateContract(config, { ...common, functionName: "deposit", args: [walletLp] });
        const data = encodeGaugeCall({ action, amount: walletLp });
        router.push(`/tx/?hash=${await submitCall(config, { to: gauge, data }, pin, GAUGE_DEPOSIT_GAS)}`);
      } else {
        await simulateContract(config, { ...common, functionName: "withdraw", args: [state.staked] });
        const data = encodeGaugeCall({ action, amount: state.staked });
        router.push(`/tx/?hash=${await submitCall(config, { to: gauge, data }, pin, GAUGE_WITHDRAW_GAS)}`);
      }
    } catch (error) {
      showError(error, { retry: () => void send(action) });
    } finally {
      setPending(null);
    }
  }

  return { claim: () => void send("claim"), stakeAll: () => void send("stake"), unstakeAll: () => void send("unstake"), pending };
}
