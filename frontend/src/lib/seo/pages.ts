import type { Metadata } from "next";

// U14 B5: one title and description per route, the static metadata each segment `layout.tsx` exports (every
// page.tsx is a client module, so it cannot). Each title gets " | MezoRoute" here (see pageMetadata). Titles follow each
// page's h1 where it is static. Confirm, exit, withdraw, and receipt pages stay out of search results.

type Page = { title: string; description: string; noindex?: true };

const trove = "Your Trove on Mezo, in one transaction through a flash swap of the MUSD/BTC pool.";

export const PAGES = {
  "/compare/": { title: "Compare routes", description: "The MUSD/BTC pool and the Stability Pool side by side for the same amount of MUSD, with the last 30 days." },
  "/proof/": { title: "Proof", description: "Every MezoRoute contract and every transaction it has run on Mezo, read from chain." },
  "/positions/": { title: "Your positions", description: "Your MUSD/BTC liquidity, Stability Pool deposit, and rewards on Mezo." },
  "/positions/lp/exit/": { title: "Exit the MUSD/BTC pool", description: "Exit your MUSD/BTC liquidity to MUSD in one transaction.", noindex: true },
  "/positions/stability-pool/withdraw/": { title: "Withdraw from the Stability Pool", description: "Withdraw MUSD and its BTC gain from Mezo's Stability Pool.", noindex: true },
  "/route/lp/": { title: "Add liquidity", description: "Deposit MUSD or BTC to the MUSD/BTC pool on Mezo in one transaction, and see what it does to your BTC risk." },
  "/route/lp/confirm/": { title: "Review your deposit", description: "Review a MUSD/BTC pool deposit before you sign.", noindex: true },
  "/route/stability-pool/": { title: "Deposit to the Stability Pool", description: "Back Mezo's system with MUSD in the Stability Pool and receive BTC from liquidations." },
  "/route/stability-pool/confirm/": { title: "Review your Stability Pool deposit", description: "Review a Stability Pool deposit before you sign.", noindex: true },
  "/trove/": { title: "Trove", description: "Your Trove on Mezo: both risks, the redemption queue, and MezoRoute's one-transaction Unwind, Close, and Leverage." },
  "/trove/open/": { title: "Open a Trove with leverage", description: trove },
  "/trove/open/confirm/": { title: "Review your new Trove", description: trove, noindex: true },
  "/trove/leverage/": { title: "Leverage your Trove", description: trove },
  "/trove/leverage/confirm/": { title: "Review your leverage", description: trove, noindex: true },
  "/trove/unwind/": { title: "Unwind your Trove", description: trove },
  "/trove/unwind/confirm/": { title: "Review your unwind", description: trove, noindex: true },
  "/trove/close/": { title: "Close your Trove", description: trove },
  "/trove/close/confirm/": { title: "Review closing your Trove", description: trove, noindex: true },
  "/tx/": { title: "Transaction", description: "What a MezoRoute transaction did, from its events.", noindex: true },
} satisfies Record<string, Page>;

export type PageRoute = keyof typeof PAGES;

/** The one share card (public/og.png, rendered from brand/og/og.html). Next replaces a parent's `openGraph` with a
 * child's instead of merging it, so every page repeats the image and site name, and the root layout uses it too. */
export const SHARE_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "MezoRoute" };
export const SITE_OPEN_GRAPH = { siteName: "MezoRoute", type: "website" as const, images: [SHARE_IMAGE] };

export function pageMetadata(route: PageRoute): Metadata {
  const page: Page = PAGES[route];
  return {
    // Absolute: a segment with a plain title drops the root template for its children, so nested pages (Confirm, exit,
    // withdraw) would lose the brand. One rule for every page instead of relying on the template.
    title: { absolute: `${page.title} | MezoRoute` },
    description: page.description,
    ...(page.noindex ? { robots: { index: false } } : {}),
    openGraph: { ...SITE_OPEN_GRAPH, title: page.title, description: page.description },
  };
}
