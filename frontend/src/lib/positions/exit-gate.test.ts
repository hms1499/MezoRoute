import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { quoteExit } from "@/lib/quote/exit";
import { PRICE_IMPACT_LIMIT, QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import { exitBlock, type ExitGateInput } from "./exit-gate";
import { LIVE_EXIT_LIQUIDITY, LIVE_EXIT_POOL } from "./test-fixtures";

const testnet = networks.testnet;
const QUOTE = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_LIQUIDITY);

function input(overrides: Partial<ExitGateInput> = {}): ExitGateInput {
  return {
    network: testnet,
    walletChainId: testnet.chainId,
    lpBalance: LIVE_EXIT_LIQUIDITY,
    liquidityIn: LIVE_EXIT_LIQUIDITY,
    quote: QUOTE,
    lacksGas: false,
    quoteAgeMs: 0,
    ...overrides,
  };
}

describe("exitBlock", () => {
  it("lets a valid exit through", () => {
    expect(exitBlock(input())).toBeNull();
  });

  it("blocks in order: no executor, wrong network, no LP, LP changed, too small, impact, gas, stale quote", () => {
    expect(exitBlock(input({ network: { ...networks.mainnet, executor: null }, walletChainId: 1, lpBalance: 0n }))?.reason).toBe("no-executor");
    expect(exitBlock(input({ walletChainId: 1, lpBalance: 0n }))?.reason).toBe("wrong-network");
    expect(exitBlock(input({ lpBalance: 0n, quote: null }))).toMatchObject({
      reason: "no-lp",
      outcome: { message: "You have no MUSD/BTC LP to exit." },
    });
    expect(exitBlock(input({ lpBalance: LIVE_EXIT_LIQUIDITY - 1n, quote: null }))).toMatchObject({
      reason: "lp-changed",
      outcome: { message: "Your LP balance changed. Review the exit again." },
    });
    expect(exitBlock(input({ quote: null, lacksGas: true }))?.reason).toBe("too-small");
    const big = quoteExit(LIVE_EXIT_POOL, LIVE_EXIT_POOL.totalSupply / 4n);
    expect(exitBlock(input({ lpBalance: LIVE_EXIT_POOL.totalSupply, liquidityIn: LIVE_EXIT_POOL.totalSupply / 4n, quote: big, lacksGas: true }))?.reason).toBe(
      "price-impact",
    );
    expect(exitBlock(input({ lacksGas: true, quoteAgeMs: QUOTE_TTL_MS + 1 }))?.reason).toBe("needs-gas");
    expect(exitBlock(input({ quoteAgeMs: QUOTE_TTL_MS + 1 }))?.reason).toBe("quote-expired");
  });

  it("allows price impact exactly at the limit and a quote exactly 60 s old", () => {
    expect(exitBlock(input({ quote: { ...QUOTE!, priceImpact: PRICE_IMPACT_LIMIT }, quoteAgeMs: QUOTE_TTL_MS }))).toBeNull();
  });
});
