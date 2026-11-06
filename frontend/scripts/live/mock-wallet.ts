// A keyless EIP-1193 wallet for live UI checks (AGENTS.md → QA): it answers accounts and chain itself, forwards reads
// to the network's RPC, refuses every signature and send, and announces itself through EIP-6963 as MetaMask. It runs
// in the page (Playwright `addInitScript`), so it is written without imports.

export type MockConfig = { theme: "light" | "dark"; network: "testnet" | "mainnet"; account?: string };

/** The 6 Nov 2026 audit accounts: the user's MetaMask on mainnet (staked LP) and testnet's "can borrow" account. */
export const ACCOUNTS = {
  mainnet: "0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8",
  testnetBorrower: "0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56",
} as const;

export function mockWallet(cfg: MockConfig): void {
  try {
    localStorage.setItem("mezoroute.theme", cfg.theme);
    localStorage.setItem("mezoroute.network", cfg.network);
  } catch {
    // Storage can be blocked; the page then uses its defaults.
  }
  if (!cfg.account) return;
  const account = cfg.account;
  const rpc = cfg.network === "mainnet" ? "https://rpc-internal.mezo.org" : "https://rpc.test.mezo.org";
  const chain = cfg.network === "mainnet" ? "0x7b7c" : "0x7b7b";
  let id = 1;
  const provider = {
    isMetaMask: true,
    on: () => undefined,
    removeListener: () => undefined,
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [account];
      if (method === "eth_chainId") return chain;
      if (method === "net_version") return String(parseInt(chain, 16));
      if (method.startsWith("wallet_")) return method.includes("Permissions") ? [{ parentCapability: "eth_accounts" }] : null;
      if (method === "eth_sendTransaction" || method.startsWith("eth_sign") || method === "personal_sign") {
        throw Object.assign(new Error("User rejected"), { code: 4001 });
      }
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
      });
      const json = await response.json();
      if (json.error) throw Object.assign(new Error(json.error.message), json.error);
      return json.result;
    },
  };
  (window as unknown as { ethereum: unknown }).ethereum = provider;
  const info = { uuid: "mock-mm", name: "MetaMask", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "io.metamask" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
}
