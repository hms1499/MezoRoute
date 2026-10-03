"use client";

import { useState } from "react";
import { erc20Abi, formatUnits, type TransactionReceipt } from "viem";
import { useAccount, useBalance, useConfig, useReadContracts } from "wagmi";
import { readContract } from "wagmi/actions";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { routerAbi } from "@/lib/abi/router";
import { explorerTxUrl, testnet } from "@/lib/config/testnet";
import { parseMusdAmount } from "@/lib/quote/amount";
import { findEnteredEvent, type EnteredEvent } from "@/lib/routes/musd-btc-lp/receipt";
import {
  buildSpikeEnterParams,
  encodeApproveCall,
  encodeEnterCall,
  ENTER_BLOCKER_MESSAGES,
  enterBlocker,
  needsApproval,
  spikeSwapAmount,
} from "@/lib/routes/musd-btc-lp/spike";
import { classifySendError } from "@/lib/tx/errors";
import { sendCall } from "@/lib/tx/send";

const { musd, btc, router, poolFactory, executor } = testnet.addresses;

type Step =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "done"; receipt: TransactionReceipt; entered: EnteredEvent | null }
  | { kind: "error"; message: string };

export function EnterPanel() {
  const config = useConfig();
  const { address, chainId } = useAccount();
  const [input, setInput] = useState("1");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const amount = parseMusdAmount(input);

  const reads = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: musd, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: musd, abi: erc20Abi, functionName: "allowance", args: [address!, executor] },
      { address: executor, abi: mezoRouteExecutorAbi, functionName: "feeBps" },
      { address: executor, abi: mezoRouteExecutorAbi, functionName: "maxMusdIn" },
    ],
    query: { enabled: Boolean(address) },
  });
  const gas = useBalance({ address, query: { enabled: Boolean(address) } });

  if (!address) return null;
  if (!reads.data || !gas.data) return <p className="text-sm text-slate-600">Reading balances…</p>;

  const owner = address;
  const [musdBalance, allowance, onchainFeeBps, maxMusdIn] = reads.data;
  const blocker = enterBlocker({ amount, chainId, onchainFeeBps, musdBalance, gasBalance: gas.data.value, maxMusdIn });
  const busy = step.kind === "busy";

  async function run() {
    if (amount === null || blocker !== null) return;
    try {
      if (needsApproval(allowance, amount)) {
        setStep({ kind: "busy", label: "Approving the exact MUSD amount…" });
        await sendCall(config, { to: musd, data: encodeApproveCall(executor, amount) });
      }
      setStep({ kind: "busy", label: "Quoting the swap…" });
      const amounts = await readContract(config, {
        address: router,
        abi: routerAbi,
        functionName: "getAmountsOut",
        args: [spikeSwapAmount(amount, testnet.executorFeeBps), [{ from: musd, to: btc, stable: false, factory: poolFactory }]],
      });
      const params = buildSpikeEnterParams({
        musdIn: amount,
        feeBps: testnet.executorFeeBps,
        btcOutQuote: amounts[1],
        recipient: owner,
        nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
      });
      setStep({ kind: "busy", label: "Sending enter…" });
      const receipt = await sendCall(config, { to: executor, data: encodeEnterCall(params) });
      setStep({ kind: "done", receipt, entered: findEnteredEvent(receipt.logs, executor) });
    } catch (error) {
      console.error(error);
      setStep({ kind: "error", message: classifySendError(error).message });
    } finally {
      await Promise.all([reads.refetch(), gas.refetch()]);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Approve + enter (testnet)</h2>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>MUSD balance</dt>
        <dd>{formatUnits(musdBalance, 18)}</dd>
        <dt>Allowance to executor</dt>
        <dd>{formatUnits(allowance, 18)}</dd>
        <dt>Executor fee</dt>
        <dd>
          {onchainFeeBps.toString()} bps (pinned {testnet.executorFeeBps.toString()})
        </dd>
        <dt>Per-tx cap</dt>
        <dd>{formatUnits(maxMusdIn, 18)} MUSD</dd>
      </dl>
      <label className="block text-sm">
        MUSD amount
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          inputMode="decimal"
          value={input}
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
        />
      </label>
      {blocker && <p className="text-sm text-amber-700">{ENTER_BLOCKER_MESSAGES[blocker]}</p>}
      <button
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-40"
        disabled={busy || blocker !== null}
        onClick={run}
      >
        {amount !== null && needsApproval(allowance, amount) ? "Approve, then enter" : "Enter"}
      </button>
      {step.kind === "busy" && <p className="text-sm">{step.label}</p>}
      {step.kind === "error" && <p className="text-sm text-red-700">{step.message}</p>}
      {step.kind === "done" && <EnteredSummary receipt={step.receipt} entered={step.entered} />}
    </section>
  );
}

function EnteredSummary({ receipt, entered }: { receipt: TransactionReceipt; entered: EnteredEvent | null }) {
  const link = (
    <a className="break-all text-indigo-700 underline" href={explorerTxUrl(receipt.transactionHash)} target="_blank" rel="noreferrer">
      {receipt.transactionHash}
    </a>
  );
  if (!entered) return <p className="text-sm text-red-700">Confirmed, but no Entered event was found: {link}</p>;
  return (
    <div className="space-y-1 text-sm">
      <p>Entered (event values): {link}</p>
      <ul className="list-disc pl-5">
        <li>
          MUSD in {formatUnits(entered.musdIn, 18)}, fee {formatUnits(entered.fee, 18)}
        </li>
        <li>
          Swapped {formatUnits(entered.musdSwapped, 18)} MUSD for {formatUnits(entered.btcFromSwap, 18)} BTC
        </li>
        <li>LP minted {formatUnits(entered.liquidityOut, 18)}</li>
        <li>
          Refund {formatUnits(entered.musdRefund, 18)} MUSD and {formatUnits(entered.btcRefund, 18)} BTC
        </li>
        <li>Caller {entered.caller}</li>
        <li>Gas used {receipt.gasUsed.toString()}</li>
      </ul>
    </div>
  );
}
