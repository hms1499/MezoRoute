"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSwitchChain } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { explorerTxUrl } from "@/lib/config/networks";
import { decodeError } from "@/lib/errors/decode";
import type { DecodedError, Recovery } from "@/lib/errors/types";

/** Recoveries only the calling page can perform; their buttons show only when a handler is passed. */
export type RecoveryHandlers = { retry?: () => void; refreshQuote?: () => void; reduceAmount?: () => void };

type ErrorToastApi = { showError: (error: unknown, handlers?: RecoveryHandlers) => void; dismiss: () => void };

const ErrorToastContext = createContext<ErrorToastApi | null>(null);

const LABELS: Record<Recovery, string> = {
  retry: "Try again",
  "refresh-quote": "Refresh quote",
  "switch-network": "Switch network",
  "add-gas": "Get test BTC",
  "reduce-amount": "Change amount",
  "copy-details": "Copy details",
  "view-transaction": "View transaction",
};

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const { network } = useNetwork();
  const [toast, setToast] = useState<{ decoded: DecodedError; handlers: RecoveryHandlers } | null>(null);
  const showError = useCallback(
    (error: unknown, handlers: RecoveryHandlers = {}) => {
      console.error(error);
      setToast({ decoded: decodeError(error, network), handlers });
    },
    [network],
  );
  const dismiss = useCallback(() => setToast(null), []);
  const api = useMemo(() => ({ showError, dismiss }), [showError, dismiss]);
  return (
    <ErrorToastContext.Provider value={api}>
      {children}
      {toast && <ErrorToast decoded={toast.decoded} handlers={toast.handlers} onDismiss={dismiss} />}
    </ErrorToastContext.Provider>
  );
}

export function useErrorToast(): ErrorToastApi {
  const api = useContext(ErrorToastContext);
  if (!api) throw new Error("useErrorToast must be used inside ErrorToastProvider");
  return api;
}

/** One error at a time; it stays until dismissed or replaced (spec §13: every error carries a recovery). */
function ErrorToast({
  decoded,
  handlers,
  onDismiss,
}: {
  decoded: DecodedError;
  handlers: RecoveryHandlers;
  onDismiss: () => void;
}) {
  const { network } = useNetwork();
  const { switchChain } = useSwitchChain();

  function action(recovery: Recovery): (() => void) | undefined {
    const thenDismiss = (run: (() => void) | undefined) =>
      run &&
      (() => {
        onDismiss();
        run();
      });
    switch (recovery) {
      case "retry":
        return thenDismiss(handlers.retry);
      case "refresh-quote":
        return thenDismiss(handlers.refreshQuote);
      case "reduce-amount":
        return thenDismiss(handlers.reduceAmount);
      case "switch-network":
        return thenDismiss(() => switchChain({ chainId: network.chainId }));
      case "add-gas":
        return network.faucetUrl ? openInNewTab(network.faucetUrl) : undefined;
      case "view-transaction":
        return decoded.hash ? openInNewTab(explorerTxUrl(network, decoded.hash)) : undefined;
      case "copy-details": {
        const details = decoded.details;
        return details ? () => void navigator.clipboard?.writeText(details) : undefined;
      }
    }
  }

  const buttons = decoded.recovery.flatMap((recovery) => {
    const run = action(recovery);
    return run ? [{ recovery, run }] : [];
  });

  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-6 sm:w-96">
      <div className="flex items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
        <p className="flex-1">{decoded.message}</p>
        {buttons.map(({ recovery, run }) => (
          <button
            key={recovery}
            type="button"
            onClick={run}
            className="shrink-0 font-semibold text-teal-300 hover:underline"
          >
            {LABELS[recovery]}
          </button>
        ))}
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="shrink-0 text-white/60 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}

function openInNewTab(url: string): () => void {
  return () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };
}
