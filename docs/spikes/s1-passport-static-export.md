# S1 spike — Mezo Passport + Next.js static export (results)

Date: 3 Oct 2026 · Branch: `feat/s1-passport-spike` · Preview: https://mezoroute-igtmvq462-hms1499s-projects.vercel.app (Vercel Deployment Protection on: unauthenticated requests get a 302 to the Vercel login)

## Verdict

Both wallet paths work on Mezo testnet from a static Next.js 14 export, locally and on a Vercel preview. MetaMask (EOA) approved and entered through `MezoRouteExecutor`. Unisat went through Mezo Passport: OrangeKit deployed the user's Safe, then relayed the approval and the `enter`. The Bitcoin path only works because `web/scripts/patch-relayer.mjs` points OrangeKit at `testnet.mezo.org`. With Passport 0.17.2 unpatched, it calls the dead `test.mezo.org`. F1 builds on this stack as is. The spec §18 fallback (EVM wallets only) is not needed.

## Stack as installed

- next 14.2.35, react 18.3.1, @mezo-org/passport 0.17.2, @rainbow-me/rainbowkit 2.0.2, wagmi 2.19.5, viem 2.57.2, @tanstack/react-query 5.104.1, TypeScript 5.9.3, Vitest 5.0.3.
- `npm ls` duplicates: one RainbowKit, one wagmi, one viem for the app and every library that shares it. `@walletconnect/utils` 2.21.x keeps its own private `viem@2.23.2`.
- legacy-peer-deps needed: no. npm only warns about peers: Passport → `@mezo-org/mezo-clay` → `baseui`, whose `react-uid` and `react-virtualized-auto-sizer` declare React 16.
- First Load JS for `/`: 91.6 kB. The wallet tree is in lazily loaded chunks.
- `node_modules` in the iCloud Desktop: npm 11 replaces a `node_modules -> node_modules.nosync` symlink with a real directory on `npm install`. `web/node_modules` is instead marked with the xattr `com.apple.fileprovider.ignore#P` so that iCloud (macOS 26 File Provider) skips it.

## Static export

`next build` with `output: "export"` succeeds once `next.config.mjs` has:

- `transpilePackages`: `@mezo-org/passport`, `@mezo-org/orangekit`, `@mezo-org/orangekit-smart-account` (ESM without `"type": "module"`), and `@mezo-org/orangekit-contracts`, which ships raw TypeScript (`main: index.ts`).
- `resolve.alias` to `false` for `@x402/{core,evm,extensions,svm}`. When Next compiles client components for the server, wagmi's Base Account connector resolves `@base-org/account`'s `node` entry. That entry imports `@coinbase/cdp-sdk`, whose optional x402 peers are not installed. The browser entry never imports them.
- `resolve.alias` to `false` for `@react-native-async-storage/async-storage`, which MetaMask SDK imports only on mobile.
- The usual WalletConnect externals: `pino-pretty`, `lokijs`, `encoding`.

The wallet tree is client-only. `layout.tsx` renders `providers.tsx` through `next/dynamic` with `ssr: false`, and `page.tsx` does the same for the page body. A dynamic route such as `/tx/[hash]` cannot be prerendered, so F1 uses `/tx/?hash=0x…`.

Vercel: `vercel project add` creates a project without a framework preset, so the first deploy looked for a `public` directory. `web/vercel.json` declares `"framework": "nextjs"`. The remote build ran `postinstall` (`patch-relayer: patched`) and `prebuild` (`already-patched`). `vercel link` adds a `VERCEL_OIDC_TOKEN` to `.env.local` and appends `.env*` to `.gitignore`; the `.gitignore` change was reverted because it would ignore `.env.example`.

## EVM wallet (MetaMask, account `0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`)

| Step | Local (`next dev`) | Vercel preview |
|---|---|---|
| Connect, kind | connected on 31611; flow ran as EOA | same |
| Approve tx | `0xdfb98343cf7b45b47e0811f21a8d55f2a9b35ccec6589104e1b96b2f157fcca7` (exactly 1 MUSD) | `0xf3f2d4309cb121455f565eb390c62e4c7b1b60fd23e4120d52c06c9ce3acff98` (exactly 1 MUSD) |
| Enter tx | `0xb7c0780b5e46122f1f6bf00362197b3e5df8b0f1d09cc0521c0c3fb7ac0ac161` (block 15936717, gas 429,190) | `0x797ae74b158824e09c402f717b4eb477e5d5466ab514b889663d1e3ac37c84c2` (block 15936908, gas 328,115) |
| Entered values | musdIn 1, fee 0.001, swapped 0.4995 MUSD → 0.000006339561438604 BTC, LP 0.001779105604201763, refund 0.000199797570165411 MUSD / 0 BTC, caller = account | musdIn 1, fee 0.001, swapped 0.4995 MUSD → 0.0000063395613769 BTC, LP 0.001779105595543553, refund 0.000199797570190833 MUSD / 0 BTC, caller = account |
| Allowance after | 0 | 0 |
| Executor balances (MUSD, BTC, LP) | 0/0/0 before and after | 0/0/0 before and after |

## Bitcoin wallet (Unisat, native SegWit `bc1q4mutsjmes2wa2zqw9fjszuav4aukuv2n3z0h0s`)

| Step | Result |
|---|---|
| Connect | Connector `Unisat (orangekit, orangekit-unisat)`, chain 31611. A mainnet-format Bitcoin address works on Mezo testnet. |
| Safe address, kind before deployment | `0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D`; `getCode` = `0x`; WalletInfo showed `smart-account`, permit no, Borrow & Deploy no (connector-based detection). |
| Funding txs | 0.0001 BTC `0x51d926c6113312fcda98b6e7340a5eecf7e7ce934b74023eae7c976991ce1cd6`, 5 MUSD `0x4f9d0fe27c6d92c51df479036572367064babe05b69d61c9d788a6a973570f6b` |
| Safe deployment tx | `0xf9e1b5798e3fac160910145b8d2d46356b4b671ef72b55ff02d27b82045ef4e6` (block 15937001; relayer → `0x7e80bd5a2e8fca0b160254d43ac9f43ac2cc1052`) |
| Approve tx (relayed) | `0xc6f1616e870c2ffb4f1682546a94ea306bfaf0371743a83196a4943f78f57d1d` (block 15937005; exactly 1 MUSD, owner = Safe) |
| Enter tx (relayed) | `0x181777d21aa79479be982ae5ef6f1f46b9d7bfaa7cd446ab677640f3d713d1b5` (block 15937007, gas 433,422; from relayer to Safe; logs end with `Entered` and Safe `ExecutionSuccess`) |
| Entered values | musdIn 1, fee 0.001, swapped 0.4995 MUSD → 0.000006339561315197 BTC, LP 0.001779105586885623, refund 0.00019979757013759 MUSD / 0 BTC, **caller = Safe** |
| Gas paid by the Safe | ≈ 0.00000000012 BTC for deployment, approval, and entry (testnet gas price 146 wei) |
| Signature prompts / relay latency | not recorded; deployment, approval, and entry confirmed within 6 blocks |
| Allowance after / executor balances | Safe allowance 0; executor 0/0/0 before and after |

## Relayer

- Endpoint: `https://testnet.mezo.org/api/v2/relay/{transactions,deploy-safe}`. Passport's `test.mezo.org` answers with Cloudflare 403 "DNS points to prohibited IP"; `web/scripts/patch-relayer.mjs` rewrites the URL on postinstall and prebuild.
- Refund receiver accepted: yes. All three relayed transactions came from `0x6e80164ea60673d64d5d6228beb684a1274bb017`, the testnet refund receiver hardcoded in OrangeKit.
- wagmi `sendTransaction` reached OrangeKit's Safe-relaying override: yes. One `sendCall` path serves both wallet kinds, and no fallback to Passport's `useSendTransaction` was needed.

## Decisions for F1

- Wallet kind: OrangeKit connector first, `getCode` second (`web/src/lib/wallet/capabilities.ts`). This was confirmed with an undeployed Safe.
- Smart-account receipts: fail on Safe `ExecutionFailure`. A relayer hash that is not 32 bytes (OrangeKit returns `"0x"`) is a relay error (`web/src/lib/tx/send.ts`).
- Wallet list: Bitcoin (Unisat, OKX, Xverse) and Ethereum (MetaMask, WalletConnect, Browser Wallet).
- Network switch: Passport's `getConfig` builds one network per config, so switching rebuilds the wagmi config.
- Bitcoin-wallet users need BTC in their Safe before the first transaction, because the Safe pays the relayer refund. F2 readiness should show the Safe's BTC and say so.
- Receipt route: `/tx/?hash=0x…`.
- Exact approvals leave allowance at 0 after `enter` for both wallet kinds.

## Reported upstream

Not yet. The dead `test.mezo.org` relayer in `@mezo-org/orangekit-smart-account` 1.0.0-beta.24 is worth reporting to the Mezo team on Discord.
