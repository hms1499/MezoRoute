/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Passport and OrangeKit ship ES modules without "type": "module"; let Next transpile them.
  transpilePackages: [
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-smart-account",
    // Ships raw TypeScript (main: index.ts).
    "@mezo-org/orangekit-contracts",
  ],
  webpack: (config) => {
    // Optional server-side dependencies of WalletConnect's logger; never used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // wagmi's Base Account connector resolves @base-org/account's "node" entry when Next compiles
    // client components for the server; that entry reaches @coinbase/cdp-sdk, whose optional x402
    // peers are not installed. The browser entry never imports them, so resolve them to nothing.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/extensions": false,
      "@x402/svm": false,
      // React Native storage that MetaMask SDK imports only on mobile.
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
