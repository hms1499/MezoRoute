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
  ],
  webpack: (config) => {
    // Optional server-side dependencies of WalletConnect's logger; never used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
