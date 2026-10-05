# F1 — App shell (design)

Date: 5 Oct 2026 · Task: F1 in `PRODUCT_SPEC.md` §16 · Depends on: S1 (`docs/spikes/s1-passport-static-export.md`) · Branch: `feat/f1-app-shell`

## Goal

Replace the S1 throwaway UI (`web/src/app/_spike/`) with the shell every later task builds on: per-network configuration, a Testnet/Mainnet switch, the shared header and mainnet banner, wallet-kind detection, a pinned send path, and an error decoder with recovery actions (spec §9, §13). F1 also closes the S1 review follow-ups that belong to the shell.

F1 ships one page, `/`. It sends no transactions: the approve → `enter` flow returns in F3 with the real quote engine.

## Decisions

| Topic | Decision |
|---|---|
| Mainnet before M1 | Selectable now, read-only. The wallet connects and reads; every write is blocked with "Mainnet actions open after launch." M1 only fills in `networks.mainnet.executor`. |
| Remembering the network | `localStorage`, default Testnet. Receipt links (F3) carry `&network=` explicitly. |
| Switching network | Store the choice, then `location.reload()`. The wagmi config is built once per page load. |
| Visual direction | "Calm teal" (palette below). |
| BOS and Stability Pool revert strings | Added with F4 and F5. F1 builds the decoder and covers the executor, Tigris Router/Pool, ERC-20, wallet, relayer, and RPC errors. |

### Why reload on switch

Passport's `getConfig` builds one chain per config, and OrangeKit's Bitcoin connectors are bound to one chain ID and RPC, so `switchChain` cannot move a Bitcoin wallet between networks. Remounting `WagmiProvider` with a new config would work but leaves RainbowKit, OrangeKit, and React Query state to clean up by hand. A reload costs a second or two on a rare action and cannot leak state from the other network. A single config with both chains was rejected: Bitcoin connectors cannot switch chains and the wallet list would show each Bitcoin wallet twice.

## 1. Network configuration

`web/src/lib/config/networks.ts` replaces `testnet.ts`:

```ts
export type NetworkId = "testnet" | "mainnet";

export type NetworkConfig = {
  id: NetworkId;
  chainId: 31611 | 31612;
  name: "Mezo Testnet" | "Mezo Mainnet";
  explorerUrl: string;
  faucetUrl: string | null;     // mainnet: null
  mezoAppUrl: string;           // testnet https://testnet.mezo.org, mainnet https://mezo.org
  /** Pinned executor and its fee (F3 compares the fee with the chain before writing). null until deployed. */
  executor: { address: Address; feeBps: bigint } | null;
  addresses: {
    musd: Address; btc: Address; router: Address; poolFactory: Address; pool: Address;
    borrowerOperationsSignatures: Address; borrowerOperations: Address; troveManager: Address;
    priceFeed: Address; hintHelpers: Address; sortedTroves: Address; stabilityPool: Address;
  };
};

export const networks: Record<NetworkId, NetworkConfig>;
export function explorerTxUrl(network: NetworkConfig, hash: string): string;
```

- Addresses come from spec §11.1, chain IDs and URLs from §20. Testnet executor: `0xB36B2E012003840951CFf00fA6b1E3237A110920`, fee 10 bps. Mainnet executor: `null`.
- Every address the app calls lives here (the allowlist). Pure modules take a `NetworkConfig` argument instead of importing a network.

`web/src/lib/config/network-choice.ts`:

- `safeStorage(getStorage?)`: wraps `window.localStorage` so that neither reaching it nor `getItem`/`setItem`/`removeItem` can throw (private mode, blocked site data, quota). It falls back to a no-op storage. The network choice and wagmi's connection storage both use it.
- `readStoredNetwork(storage): NetworkId`: returns `"testnet"` when the value is missing or invalid.
- `storeNetwork(storage, id)`: writes the key `mezoroute.network`. If the write is swallowed by `safeStorage`, the reload keeps the previous network, so the switch has no effect.
- `switchNetworkAndReload(current, requested, storage, reload)`: does nothing when `requested === current`; otherwise stores and reloads.

`web/src/lib/config/write-gate.ts`, the single gate for every write button (FR-01):

```ts
export type WriteBlocker = "no-executor" | "wrong-network";
export function writeBlocker(network: NetworkConfig, walletChainId: number | undefined): WriteBlocker | null;
```

`"no-executor"` (the network has no executor yet) wins over `"wrong-network"`. Messages: "Mainnet actions open after launch. Reading only." and "MezoRoute executes on {network.name}."

## 2. Providers and boot

- `layout.tsx` stays static: metadata (title "MezoRoute"), Tailwind tokens, and `ClientProviders` (unchanged `next/dynamic`, `ssr: false`).
- `providers.tsx` reads the stored network once (`useState` initialiser), then builds:
  - `createWagmiConfig(network, walletConnectProjectId)` in `lib/wallet/passport.ts`: `getConfig({ mezoNetwork: network.id, wallets, storage })`, with Bitcoin wallets `unisat/okx/xverseWalletMezo{Testnet|Mainnet}` matching the network, Ethereum wallets MetaMask, WalletConnect, Browser Wallet, and `storage: createStorage({ key: "mezoroute.<id>", storage: safeStorage() })` so each network remembers its own connection.
  - `QueryClient`, `RainbowKitProvider` with `lightTheme({ accentColor: "#0F766E", borderRadius: "large" })`.
  - `NetworkProvider` (`lib/config/network-context.tsx`): `useNetwork()` returns `{ network: NetworkConfig, switchNetwork(id: NetworkId) }`; `switchNetwork` calls `switchNetworkAndReload` with `location.reload()`.
- Passport's default RPCs are used (`rpc.test.mezo.org`; mainnet `rpc-internal.mezo.org`, which answered chain 31612 on 5 Oct 2026). The mainnet relayer `mezo.org/api/v2/relay` is live (not the Cloudflare 403 of `test.mezo.org`), so `patch-relayer.mjs` stays testnet-only.

## 3. Wallet kind and sending

`lib/wallet/capabilities.ts`:

- `WalletKind = "eoa" | "smart-account" | "unknown"`.
- `walletKind({ connectorType, connectorId, hasCode: boolean | undefined })`: an OrangeKit connector (`type === "orangekit"` or id `orangekit-*`) gives `smart-account`; otherwise `hasCode === undefined` (the `getCode` read failed) gives `unknown`; otherwise code present gives `smart-account`, absent gives `eoa`.
- `walletCapabilities("unknown")` equals the smart-account capabilities (no permit, no Borrow & Deploy). The UI explains: "Couldn't check your wallet type; using exact approvals."

`lib/wallet/useWalletKind.ts` (moved from `_spike/`) returns `undefined` while the bytecode read is pending and passes `hasCode: undefined` when it errored. The read is keyed by account and chain.

`lib/tx/send.ts`:

```ts
export type SendPin = { account: Address; chainId: number };
export async function sendCall(config: Config, call: { to: Address; data: Hex }, pin: SendPin): Promise<TransactionReceipt>;
```

- Callers capture `pin` once, when the user starts a flow, and pass the same pin to every step.
- `sendTransaction(config, { to, data, account: pin.account, chainId: pin.chainId })`: wagmi 2.19.5 throws `ConnectorChainMismatchError` if the wallet moved to another chain and `ConnectorAccountNotFoundError` if the account is no longer connected (checked in `@wagmi/core` `getConnectorClient`), so a later step cannot send from another account or chain.
- `waitForTransactionReceipt(config, { hash, chainId: pin.chainId, pollingInterval: 2_000, timeout: 120_000 })`. Once a hash exists, a failure of this wait is classified by `receiptFailure(error, hash)`:
  - viem's `WaitForTransactionReceiptTimeoutError` → `ConfirmationTimeoutError(hash)`;
  - positive evidence of a revert → `TransactionRevertedError(hash)`: revert data on the cause chain, `CallExecutionError`/`ExecutionRevertedError`/`ContractFunctionRevertedError`, or the plain `Error(reason)` wagmi throws after replaying a reverted transaction;
  - anything else → `ConfirmationTimeoutError(hash)`: RPC failures, and viem's `TransactionReceiptNotFoundError`/`BlockNotFoundError` when the flaky testnet RPC returns null again during viem's replacement check. The outcome is unknown, so the user must not be told to retry (that could send twice).
- A receipt with a status other than `success` also throws `TransactionRevertedError(hash)`.
- Unchanged from S1: `asRelayFailure` around the send, `assertTxHash` (relayer `"0x"`), `hasSafeExecutionFailure` → `SmartAccountCallFailedError`.

## 4. Error decoder

`web/src/lib/errors/`:

```ts
export type Recovery =
  | "retry" | "refresh-quote" | "switch-network" | "add-gas" | "reduce-amount" | "copy-details" | "view-transaction";
export type ErrorKind =
  | "rejected" | "relay" | "smart-account-reverted" | "unconfirmed" | "wrong-network" | "account-changed"
  | "needs-gas" | "quote-expired" | "slippage" | "above-cap" | "amount-too-small"
  | "allowance" | "insufficient-balance" | "pool" | "reverted" | "rpc-unavailable" | "unknown";
export type DecodedError = { kind: ErrorKind; message: string; recovery: Recovery[]; details?: string; hash?: Hash };
export function decodeError(error: unknown, network: NetworkConfig): DecodedError;
```

The first matching rule wins:

| # | Match | Kind · message · recovery |
|---|---|---|
| 1 | EIP-1193 code 4001 anywhere on the cause chain (plain objects included), or rejection text | `rejected` · "Transaction was not signed." · retry |
| 2 | `RelayError` | `relay` · "Mezo's relayer could not submit the transaction. Retry in a moment." · retry |
| 3 | `SmartAccountCallFailedError` | `smart-account-reverted` · "Your smart account sent the transaction, but the call reverted." · retry, copy-details |
| 3b | `ConfirmationTimeoutError` | `unconfirmed` · "Your transaction was sent but is not confirmed yet. Check it in the explorer before trying again." · view-transaction |
| 4 | `ConnectorChainMismatchError` (by `name`) | `wrong-network` · "MezoRoute executes on {network.name}." · switch-network |
| 5 | `ConnectorAccountNotFoundError` (by `name`) | `account-changed` · "Your wallet account changed. Review and try again." · retry |
| 6 | "insufficient funds" / "not enough native token balance" | `needs-gas` · testnet "You need test BTC to submit transactions." · add-gas; mainnet "You need BTC on Mezo to pay for gas." · no recovery |
| 7 | Revert data found on the cause chain (`ContractFunctionRevertedError`, `CallExecutionError`, `RawContractError`, any `data: 0x…`) and decoded with the combined error ABI | per the revert table below |
| 8 | A revert without data, including wagmi's empty `Error("")` after a successful replay | `reverted` · "The transaction reverted." · retry, copy-details (details include the hash when known) |
| 9 | `HttpRequestError`, `TimeoutError`, "failed to fetch" | `rpc-unavailable` · "{network.name} is temporarily unavailable." · retry |
| 10 | Anything else | `unknown` · "Something went wrong." · retry, copy-details (details: shortened message and data) |

Revert table (by decoded error name or `Error(string)` text):

| Revert | Kind · message · recovery |
|---|---|
| `Expired` (executor or Router) | `quote-expired` · "Pool state changed; refresh your quote." · refresh-quote |
| `InsufficientSwapOutput`, `InsufficientLiquidityOutput`, `InsufficientFinalOutput`, Router `InsufficientOutputAmount`, `InsufficientAmount`, `InsufficientAmountA`, `InsufficientAmountB` | `slippage` · "Output fell below your minimum." · refresh-quote |
| `AmountAboveCap` | `above-cap` · mainnet "Mainnet deposits are limited to 1,000 MUSD per transaction while unaudited."; testnet "Amount is above the per-transaction cap." · reduce-amount |
| `InvalidSwapAmount`, `ZeroAmount` | `amount-too-small` · "Amount is too small to route." · reduce-amount |
| OZ5 `ERC20InsufficientAllowance`, OZ4 "ERC20: insufficient allowance" | `allowance` · "The approval does not cover this amount." · retry |
| OZ5 `ERC20InsufficientBalance`, OZ4 "ERC20: transfer amount exceeds balance" | `insufficient-balance` · "Amount exceeds your available MUSD." · reduce-amount |
| Pool `K`, `InsufficientLiquidity`, `InsufficientLiquidityMinted`, `InsufficientLiquidityBurned`, `IsPaused` | `pool` · "The pool cannot take this trade right now." · refresh-quote |
| Any other decoded error or string | `reverted` · "The transaction reverted." · retry, copy-details (details: error name or string) |

- The combined error ABI is the executor ABI's errors, the Tigris Router and Pool errors, OZ5 ERC-20 errors, `Error(string)`, and `Panic(uint256)`. `scripts/sync-abi.mjs` also writes `src/lib/abi/tigrisErrors.ts` from `contracts/out/Router.sol/Router.json` and `contracts/out/Pool.sol/Pool.json` (error entries only, de-duplicated by selector).
- Known `Error(string)` texts live in `src/lib/errors/revert-strings.ts` as `{ match: RegExp, outcome: { kind, message, recovery } }` rows; F4 (BOS) and F5 (Stability Pool) add rows there.
- `lib/tx/errors.ts` keeps `RelayError`, `SmartAccountCallFailedError`, and `asRelayFailure`, and adds `TransactionRevertedError` and `ConfirmationTimeoutError` (both carry `hash`); `classifySendError` is removed.
- `details` are capped at 300 characters; the toast never shows raw error text, only the fixed messages above.

Display: `useErrorToast()` from `components/ErrorToast.tsx` exposes `showError(error: unknown, handlers?: { retry?, refreshQuote?, reduceAmount? })`. It decodes with the active network and renders one button per recovery: `switch-network` calls wagmi `switchChain({ chainId: network.chainId })`, `add-gas` opens `network.faucetUrl`, `view-transaction` opens the explorer for `hash`, and `copy-details` writes `details` to the clipboard. The other recoveries show only when the caller passes a handler. An error toast stays until dismissed; a new error replaces the current one.

## 5. UI

Palette (Tailwind `theme.extend.colors`): `canvas #F6F8F7`, `ink #1F2A2E`, `muted #4B5B5F`, `accent #0F766E`, `accent-soft #ECF5F3`, `line #E4ECEA`, `warning-bg #FEF3C7`, `warning-ink #92400E`, `danger #B42318`, `danger-soft #FEECEB`. System font stack; rounded cards (`rounded-2xl`), soft shadow, generous whitespace.

Components (`web/src/components/`):

- `AppShell`: header, mainnet banner, `<main>` (max width ~42 rem, 16 px side gutter), toast host.
- `Header`: logo mark + "MezoRoute" (mark only below `sm`), `NetworkSwitch` (segmented Testnet | Mainnet → `switchNetwork`), RainbowKit `ConnectButton`.
- `MainnetBanner`: shown whenever Mainnet is selected, not dismissible: "Unaudited · max 1,000 MUSD per transaction".
- `ErrorToast`: bottom-right on desktop, full-width bottom on phones.

Page `/` (`app/page.tsx` → dynamic, client-only `Home`):

1. Disconnected: a network pill, the headline "Put your MUSD to work, and see what it does to your BTC risk.", one sentence on the LP and Stability Pool routes and no custody, and a "Connect a Bitcoin or EVM wallet" button; footnote "Unaudited software." (+ "Testnet tokens have no value." on Testnet).
2. Wrong chain (wallet chain ≠ selected network; in practice EVM wallets only, since OrangeKit connectors stay on the configured chain): inline danger alert "MezoRoute executes on {network.name}." with **Switch network**, above the wallet card. Inline rather than a toast because it lasts until fixed. Reads still go to the selected network's RPC, so the card keeps showing balances.
3. Connected: "Your wallet" card with wallet (connector name and kind: "standard wallet", "Bitcoin wallet (smart account)", "smart account", or "unknown"), Bitcoin address (Bitcoin wallets, from Passport `useBitcoinAccount`), Mezo account, BTC for gas, and MUSD balance. Notes: smart account → "Your Bitcoin wallet acts through a smart account: approvals are exact and sent as separate transactions."; unknown → the §3 message; Mainnet → "Mainnet actions open after launch. Reading only." Buttons: "Get test BTC" (Testnet only, `faucetUrl`) and "Open Mezo app" (`mezoAppUrl`). Amounts are truncated (never rounded up) to 6 decimals with thousands separators; a non-zero amount below 0.000001 shows as "<0.000001", never "0". Formatting helpers live in `lib/format.ts`, wallet-kind labels and notes in `lib/wallet/labels.ts`.

F2 replaces the wallet card with readiness, the Trove card, and the exposure panel. Copy follows spec §9 copy rules.

## 6. Build guards and cleanup

Scripts in `web/scripts/` (each exports a pure function that a Vitest test covers, plus a `main` guarded by `import.meta.url`):

- `check-env.mjs` (`prebuild`): loads `.env*` with `@next/env` `loadEnvConfig`, fails the build when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is missing or empty. The runtime throw in `walletConnectProjectId()` stays.
- `check-relayer-bundle.mjs` (`postbuild`): scans `out/_next/static/**/*.js`; fails unless some file contains `https://testnet.mezo.org/api/v2/relay/` and none contains `https://test.mezo.org/api/v2/relay/`.
- `icloud-ignore.mjs` (`predev`, `prebuild`): on macOS creates `.next/` if missing and sets the xattr `com.apple.fileprovider.ignore#P` on it; no-op on other platforms. `out/` is deliberately not marked: `next build` deletes and recreates it, which drops the mark, and iCloud then renamed the fresh export to `out 2` (found during F1, 5 Oct 2026). `.next/` is only emptied, so its mark survives.
- Script order: `prebuild` = icloud-ignore → patch-relayer → check-env; `postbuild` = check-relayer-bundle.

Cleanup:

- Delete `src/app/_spike/` and `src/lib/config/testnet.ts` (+ test).
- Rename `src/lib/routes/musd-btc-lp/spike.ts` → `params.ts`, keeping `EnterParams`, `NO_PERMIT`, `DEADLINE_SECONDS`, `netOfFee`, `encodeEnterCall`, `encodeApproveCall`, `needsApproval`; drop `spikeSwapAmount`, `buildSpikeEnterParams`, `SPIKE_SLIPPAGE_BPS`, `enterBlocker`, `ENTER_BLOCKER_MESSAGES` (F3 rebuilds the risk gates with the quote engine, including blocking a swap amount that rounds to 0).
- `receipt.ts` and `amount.ts` stay.

## 7. Testing

Vitest (node environment, no component tests):

- `networks`: addresses are checksummed (`getAddress(x) === x`), chain IDs equal OrangeKit's `mezoTestnet.id`/`mezoMainnet.id` (Passport re-exports them; importing Passport itself needs `window`), testnet executor and fee as pinned, mainnet executor `null`, `faucetUrl` null on mainnet, `explorerTxUrl`.
- `network-choice`: missing, invalid, valid values; `safeStorage` with an unreachable storage, throwing `getItem`, throwing `setItem`; `switchNetworkAndReload` same-network no-op.
- `writeBlocker`: no executor, wrong chain, undefined chain, OK; `no-executor` wins.
- `walletKind` / `walletCapabilities`: OrangeKit with and without code, `hasCode` undefined → `unknown`, EOA, contract wallet.
- `sendCall` (with `vi.mock("wagmi/actions")`): passes `account` and `chainId` to `sendTransaction` and `chainId` to `waitForTransactionReceipt`; relays `"0x"` → `RelayError`; Safe `ExecutionFailure` → `SmartAccountCallFailedError`; OrangeKit fetch failure → `RelayError`; each `receiptFailure` branch.
- `format` and `labels`: truncation, separators, the "<0.000001" floor, each wallet-kind label and note.
- `decodeError`: one case per rule and per revert-table row, built with viem/wagmi error classes and encoded revert data (`encodeErrorResult`), plus the S1 cases already in `tx/errors.test.ts` (Xverse plain `{ code: 4001 }`, relayer JSON/fetch failures).
- `check-env`, `check-relayer-bundle`, `icloud-ignore` (platform branch only).
- Existing `params` (ex-`spike`), `receipt`, `amount`, `safe`, `patch-relayer` tests keep passing.

Manual QA on Testnet, locally and on a Vercel preview:

- MetaMask: connect; switch the wallet to another chain → the inline alert appears and **Switch network** fixes it.
- Unisat through Passport: connect; the card shows the Bitcoin address, the Safe address, and "Bitcoin wallet (smart account)".
- Testnet → Mainnet → Testnet: each switch reloads; each network reconnects its own wallet; on Mainnet the banner shows and the read-only note appears.
- Phone width (360 px): no horizontal scroll; header shows the mark only.

## Done when

- `cd web && npm test && npm run build` pass (build includes lint, type check, and the new guards).
- The manual QA list passes on a Vercel preview.
- `CLAUDE.md` frontend notes describe the network switch (reload, `mezoroute.network`, per-network wagmi storage keys) and the new build guards; spec §16 records F1 as done; the S1 findings doc marks the follow-ups F1 closed.

## Out of scope

Readiness, Trove, and exposure (F2); quote engine, LP pages, transaction state machine, receipt page (F3); BOS strings and Borrow & Deploy (F4); Stability Pool and its strings (F5); mainnet executor address (M1); Vercel production env (V1).
