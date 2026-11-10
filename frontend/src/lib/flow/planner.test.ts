import { describe, expect, it } from "vitest";
import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";
import { plannerView } from "./planner";

// U13 anti-goal: a visitor must never see the wallet's gate (an "insufficient balance" the visitor has not tried to
// fund) or a network warning before a wallet connects.

const block: EntryBlock = { reason: "insufficient-balance", outcome: null };

describe("plannerView", () => {
  it("hides the wallet's gate and the network warning before a wallet connects", () => {
    expect(plannerView({ connected: false, block, walletChainId: 31612, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });

  it("passes the gate and the network warning through once connected", () => {
    expect(plannerView({ connected: true, block, walletChainId: 31612, chainId: 31611 })).toEqual({ block, wrongNetwork: true });
    expect(plannerView({ connected: true, block: null, walletChainId: 31611, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });

  // wagmi reports an account before the chain it sits on; warning then blames a wallet whose network is unknown.
  it("waits for the wallet's chain before warning about the network", () => {
    expect(plannerView({ connected: true, block: null, walletChainId: undefined, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });
});
