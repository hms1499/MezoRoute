// U11 §6.6: proof that a UI change left transaction building untouched (never part of `npm test`).
//   build main and the branch, serve each `out/` on its own port, then:
//   CALLDATA_BASE=http://127.0.0.1:4319 CALLDATA_HEAD=http://127.0.0.1:4318 npm run calldata-parity
// Each flow is driven to its first wallet request with the keyless mock wallet (an EOA, and a smart account: an
// address with code), once per build. Every RPC and explorer answer is recorded on a first live pass over the base
// build and replayed to both builds, so both see the same chain. The wallet payloads (eth_sendTransaction,
// eth_signTypedData_v4) must match field by field; only time-derived fields are masked (permit and quote deadlines).
// CALLDATA_ONLY=lp-musd,exit narrows the flows by name prefix.
// PLAYWRIGHT_CHROMIUM_EXECUTABLE points Playwright at a local Chromium when its own is not installed.

import { chromium, type Browser, type BrowserContext, type Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockWallet, type MockConfig } from "./mock-wallet";

type Flow = { name: string; url: string; network: MockConfig["network"]; account: string; button: RegExp };

const EOA_MAINNET = "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8"; // the user's MetaMask: MUSD, BTC, staked LP
const EOA_BORROWER = "0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56"; // testnet "can borrow"
const SAFE_TESTNET = "0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D"; // the user's Unisat Safe: has code, so a smart account (≈0.7 MUSD, wallet LP)

const FLOWS: Flow[] = [
  { name: "lp-musd eoa", url: "/route/lp/confirm/?amount=10&slippage=1", network: "mainnet", account: EOA_MAINNET, button: /^Sign/ },
  { name: "lp-btc eoa", url: "/route/lp/confirm/?amount=0.00003&slippage=1&asset=btc", network: "mainnet", account: EOA_MAINNET, button: /^Sign/ },
  { name: "lp-unstaked eoa", url: "/route/lp/confirm/?amount=10&slippage=0.5&stake=0", network: "mainnet", account: EOA_MAINNET, button: /^Sign/ },
  { name: "borrow eoa", url: "/route/lp/confirm/?amount=100&slippage=1&mode=borrow", network: "testnet", account: EOA_BORROWER, button: /^Sign/ },
  { name: "sp-deposit eoa", url: "/route/stability-pool/confirm/?amount=10", network: "mainnet", account: EOA_MAINNET, button: /^(Approve|Send)/ },
  { name: "exit-50 eoa", url: "/positions/lp/exit/?percent=50&slippage=1", network: "mainnet", account: EOA_MAINNET, button: /^(Unstake|Sign)/ },
  { name: "exit-max eoa", url: "/positions/lp/exit/?percent=100&slippage=2", network: "mainnet", account: EOA_MAINNET, button: /^(Unstake|Sign)/ },
  { name: "claim-mezo eoa", url: "/positions/", network: "mainnet", account: EOA_MAINNET, button: /^Claim MEZO$/ },
  { name: "claim-fees eoa", url: "/positions/", network: "mainnet", account: EOA_MAINNET, button: /^Claim fees$/ },
  { name: "sp-withdraw eoa", url: "/positions/stability-pool/withdraw/?percent=50", network: "mainnet", account: EOA_MAINNET, button: /^Withdraw$/ },
  { name: "lp-musd safe", url: "/route/lp/confirm/?amount=0.5&slippage=1", network: "testnet", account: SAFE_TESTNET, button: /^(Approve|Send)/ },
  { name: "lp-btc safe", url: "/route/lp/confirm/?amount=0.000005&slippage=1&asset=btc", network: "testnet", account: SAFE_TESTNET, button: /^(Approve|Send)/ },
  { name: "sp-deposit safe", url: "/route/stability-pool/confirm/?amount=0.5", network: "testnet", account: SAFE_TESTNET, button: /^(Approve|Send)/ },
  { name: "stake-all safe", url: "/positions/", network: "testnet", account: SAFE_TESTNET, button: /^Stake all$/ },
  { name: "claim-fees safe", url: "/positions/", network: "testnet", account: SAFE_TESTNET, button: /^Claim fees$/ },
  { name: "exit-50 safe", url: "/positions/lp/exit/?percent=50&slippage=1", network: "testnet", account: SAFE_TESTNET, button: /^(Unstake|Approve|Send)/ },
];

const BASE = process.env.CALLDATA_BASE ?? "http://127.0.0.1:4319";
const HEAD = process.env.CALLDATA_HEAD ?? "http://127.0.0.1:4318";
const HOSTS = /^https:\/\/(rpc-internal\.mezo\.org|rpc\.test\.mezo\.org|api\.explorer(\.test)?\.mezo\.org)\//;
const READY_MS = 45_000;

/** The recorded chain: one answer per request, keyed without the JSON-RPC id. */
const tape = new Map<string, { status: number; body: string }>();
let recording = true;

const rpcKey = (call: { method?: string; params?: unknown }) => `${call.method}:${JSON.stringify(call.params ?? null)}`;

async function live(route: Route): Promise<{ status: number; body: string }> {
  const response = await route.fetch();
  return { status: response.status(), body: await response.text() };
}

/** Records on the first pass and replays afterwards; a request the tape lacks is fetched live and recorded. */
async function onRoute(route: Route) {
  const request = route.request();
  const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-headers": "*" } });
  const post = request.postData();
  if (request.method() !== "POST" || !post) {
    const key = `GET ${request.url()}`;
    if (recording || !tape.has(key)) tape.set(key, await live(route));
    const hit = tape.get(key)!;
    return route.fulfill({ status: hit.status, headers, body: hit.body });
  }
  const payload = JSON.parse(post) as { id: unknown; method: string; params: unknown } | { id: unknown; method: string; params: unknown }[];
  const calls = Array.isArray(payload) ? payload : [payload];
  const misses = calls.filter((call) => recording || !tape.has(rpcKey(call)));
  if (misses.length > 0) {
    const fresh = await live(route);
    const parsed = JSON.parse(fresh.body) as { id: unknown } | { id: unknown }[];
    const answers = Array.isArray(parsed) ? parsed : [parsed];
    for (const call of calls) {
      const answer = answers.find((entry) => entry.id === call.id);
      if (answer) tape.set(rpcKey(call), { status: fresh.status, body: JSON.stringify(answer) });
    }
  }
  const replies = calls.map((call) => {
    const hit = tape.get(rpcKey(call));
    return hit ? { ...JSON.parse(hit.body), id: call.id } : { jsonrpc: "2.0", id: call.id, error: { code: -32000, message: "not recorded" } };
  });
  return route.fulfill({ status: 200, headers, body: JSON.stringify(Array.isArray(payload) ? replies : replies[0]) });
}

/** The page's wallet requests that sign or send, captured before the mock rejects them. */
function captureWallet() {
  const w = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; __wrapped?: boolean }; __calls: unknown[] };
  w.__calls = [];
  const wrap = () => {
    const provider = w.ethereum;
    if (!provider || provider.__wrapped) return;
    const original = provider.request.bind(provider);
    provider.request = (args) => {
      if (args.method === "eth_sendTransaction" || args.method.startsWith("eth_sign")) w.__calls.push({ method: args.method, params: args.params });
      return original(args);
    };
    provider.__wrapped = true;
  };
  wrap();
  setInterval(wrap, 20);
}

/** Masks what depends on the clock: permit and quote deadlines. */
function normalise(call: { method: string; params: unknown[] }): unknown {
  if (call.method === "eth_signTypedData_v4") {
    const typed = JSON.parse(String(call.params[1])) as { message: Record<string, unknown> };
    if ("deadline" in typed.message) typed.message.deadline = "<deadline>";
    return { method: call.method, signer: String(call.params[0]).toLowerCase(), typed };
  }
  const tx = call.params[0] as Record<string, string>;
  return { method: call.method, from: tx.from?.toLowerCase(), to: tx.to?.toLowerCase(), value: tx.value ?? "0x0", gas: tx.gas, data: tx.data };
}

async function drive(browser: Browser, base: string, flow: Flow): Promise<{ status: string; calls: unknown[] }> {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(HOSTS, onRoute);
  await context.addInitScript(mockWallet, { theme: "light", network: flow.network, account: flow.account });
  await context.addInitScript(captureWallet);
  const page = await context.newPage();
  try {
    await page.goto(base + flow.url);
    const button = page.getByRole("button", { name: flow.button }).first();
    const deadline = Date.now() + READY_MS;
    while (Date.now() < deadline && !(await button.isVisible().catch(() => false) && (await button.isEnabled().catch(() => false)))) {
      await page.waitForTimeout(500);
    }
    if (!(await button.isEnabled().catch(() => false))) return { status: "no enabled button", calls: [] };
    await button.click();
    await page.waitForTimeout(4000);
    const calls = (await page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls)) as { method: string; params: unknown[] }[];
    return { status: calls.length > 0 ? "wallet request" : "no wallet request", calls: calls.map(normalise) };
  } finally {
    await context.close();
  }
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
});
afterAll(async () => {
  await browser?.close();
});

describe("calldata parity (U11 §6.6)", () => {
  const only = process.env.CALLDATA_ONLY?.split(",");
  it.each(FLOWS.filter((flow) => !only || only.some((name) => flow.name.startsWith(name))).map((flow) => [flow.name, flow] as const))("%s sends the same payload on both builds", async (_name, flow) => {
    recording = true;
    await drive(browser, BASE, flow); // records the chain this flow reads
    recording = false;
    const base = await drive(browser, BASE, flow);
    const head = await drive(browser, HEAD, flow);
    process.stdout.write(`${flow.name}: base ${base.status} (${base.calls.length}), head ${head.status} (${head.calls.length})\n`);
    for (const call of head.calls) process.stdout.write(`  ${JSON.stringify(call).slice(0, 400)}\n`);
    expect(head.status).toBe(base.status);
    expect(head.calls).toEqual(base.calls);
  });
});
