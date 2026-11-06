// U11 §7: the UI audit, a live check against a served build (never part of `npm test`).
//   cd frontend && npm run build && npx serve out -l 4318 &
//   npm run ui-audit                       (UI_AUDIT_URL, UI_AUDIT_WIDTHS, UI_AUDIT_THEMES, UI_AUDIT_PAGES narrow it)
// It loads every page with the keyless mock wallet and fails on any rule DESIGN.md makes checkable in a browser.
// Playwright's own browser is used; PLAYWRIGHT_CHROMIUM_EXECUTABLE points it at another Chromium when needed.

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACCOUNTS, mockWallet, type MockConfig } from "./mock-wallet";

type Page = { name: string; url: string; network: MockConfig["network"]; account?: string };

const RECEIPT = "0x415b5af4db1f5e0415d7802f7f0cf468b5b3ab3556c43e59746243685b4a1445";
const PAGES: Page[] = [
  { name: "landing", url: "/", network: "mainnet" },
  { name: "dashboard", url: "/", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "positions", url: "/positions/", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "lp", url: "/route/lp/?amount=10", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "lp-btc", url: "/route/lp/?asset=btc&amount=0.00003", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "lp-confirm", url: "/route/lp/confirm/?amount=10&slippage=1", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "lp-exit", url: "/positions/lp/exit/?percent=50&slippage=1", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "sp", url: "/route/stability-pool/?amount=10", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "sp-confirm", url: "/route/stability-pool/confirm/?amount=10", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "sp-withdraw", url: "/positions/stability-pool/withdraw/?percent=50", network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "receipt", url: `/tx/?hash=${RECEIPT}`, network: "mainnet", account: ACCOUNTS.mainnet },
  { name: "dashboard-trove", url: "/", network: "testnet", account: ACCOUNTS.testnetBorrower },
  { name: "borrow", url: "/route/lp/?mode=borrow&amount=100", network: "testnet", account: ACCOUNTS.testnetBorrower },
];

const BASE = process.env.UI_AUDIT_URL ?? "http://127.0.0.1:4318";
const WIDTHS = (process.env.UI_AUDIT_WIDTHS ?? "360,768,1024,1440").split(",").map(Number);
const THEMES = (process.env.UI_AUDIT_THEMES ?? "light,dark").split(",") as MockConfig["theme"][];
const ONLY = process.env.UI_AUDIT_PAGES?.split(",");

/** Runs in the page: every rule break it can see, as short strings. */
function audit({ width, landing }: { width: number; landing: boolean }): string[] {
  const out: string[] = [];
  const visible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !el.closest(".sr-only, [aria-hidden=true]");
  };
  const label = (el: Element) => ((el.getAttribute("aria-label") || (el as HTMLElement).innerText || "").trim().replace(/\s+/g, " ").slice(0, 30));
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim().split(/\s+/).join(", ");

  // Buttons: a boxed, padded control is 44, 36, or 28 px tall; at most one filled primary per page.
  let primaries = 0;
  for (const el of document.querySelectorAll("button, a, [role=button], [role=tab], [role=radio], [role=menuitemradio]")) {
    if (!visible(el)) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const filled = style.backgroundColor === `rgb(${accent})`;
    if (filled && el.closest("main")) primaries += 1;
    const boxed = style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== "none";
    if (boxed && parseFloat(style.paddingLeft) >= 8 && ![44, 36, 28].includes(Math.round(rect.height))) out.push(`button height ${Math.round(rect.height)}: "${label(el)}"`);
    // Hit area: the element or its .hit ::after; inline targets inside a sentence are exempt.
    const block = el.parentElement;
    const inline =
      el.hasAttribute("data-inline-target") ||
      (style.display === "inline" && block !== null && (block.textContent ?? "").trim().length > (el.textContent ?? "").trim().length);
    if (inline) continue;
    const after = el.classList.contains("hit") ? getComputedStyle(el, "::after") : null;
    const w = Math.max(rect.width, after ? parseFloat(after.width) || 0 : 0);
    const h = Math.max(rect.height, after ? parseFloat(after.height) || 0 : 0);
    const min = width < 768 ? 44 : 24;
    if (Math.round(w) < min || Math.round(h) < min) out.push(`hit ${Math.round(w)}×${Math.round(h)} < ${min}: "${label(el)}"`);
  }
  // The landing repeats its one action (hero and final call); every app page has at most one primary.
  if (!landing && primaries > 1) out.push(`${primaries} primary buttons`);

  // Radii: only the tokens (and the landing frame's 4 px).
  const radii = new Set(["0px", "4px", "8px", "12px", "16px", "9999px"]);
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const r = getComputedStyle(el).borderTopLeftRadius;
    if (!radii.has(r) && !r.endsWith("%")) out.push(`radius ${r}: ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
  }

  // One h1.
  const h1s = [...document.querySelectorAll("h1")].filter(visible).length;
  if (h1s !== 1) out.push(`${h1s} h1`);

  // 12 px is for captions: no 12 px run longer than 80 characters.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").trim();
    const el = node.parentElement;
    if (text.length <= 80 || !el || !visible(el) || el.closest("svg")) continue;
    if (getComputedStyle(el).fontSize === "12px") out.push(`12px sentence: "${text.slice(0, 40)}…"`);
  }

  if (document.documentElement.scrollWidth > window.innerWidth) out.push(`horizontal scroll ${document.documentElement.scrollWidth}px`);
  return [...new Set(out)];
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
});
afterAll(async () => {
  await browser?.close();
});

describe("UI audit (U11 §7)", () => {
  const pages = PAGES.filter((page) => !ONLY || ONLY.includes(page.name));

  // One test per page, so each gets its own timeout (8 loads at most).
  it.each(pages.map((page) => [page.name, page] as const))("%s breaks no rule", async (_name, page) => {
    const failures: string[] = [];
    for (const theme of THEMES)
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript(mockWallet, { theme, network: page.network, account: page.account });
        const tab = await context.newPage();
        const errors: string[] = [];
        tab.on("console", (message) => message.type() === "error" && errors.push(message.text().slice(0, 120)));
        tab.on("pageerror", (error) => errors.push(String(error).slice(0, 120)));
        await tab.goto(BASE + page.url);
        await tab.waitForTimeout(page.account ? 8000 : 4000);
        const found = [...(await tab.evaluate(audit, { width, landing: page.name === "landing" })), ...errors.map((error) => `console: ${error}`)];
        const line = `${page.name}@${width}/${theme}: ${found.length === 0 ? "ok" : found.join(" | ")}`;
        process.stdout.write(`${line}\n`);
        if (found.length > 0) failures.push(line);
        await context.close();
      }
    expect(failures).toEqual([]);
  });
});
