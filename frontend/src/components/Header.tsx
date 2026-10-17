"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cx } from "@/lib/ui/cx";
import { isCurrentPath } from "@/lib/ui/nav";
import { NetworkSwitch } from "./NetworkSwitch";

const NAV = [
  { href: "/", label: "Dashboard", mobile: false },
  { href: "/positions/", label: "Positions", mobile: true },
];

/** Shared header (spec §9): logo, nav with the current page marked, Testnet/Mainnet switch, wallet button. */
export function Header() {
  const pathname = usePathname();
  return (
    <header className="flex items-center gap-2 py-4 sm:gap-4">
      <Link href="/" aria-label="MezoRoute home" className="shrink-0 rounded-lg">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex flex-1 items-center justify-center gap-1">
        {NAV.map((item) => {
          const current = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cx(
                "min-h-9 items-center rounded-full px-2.5 text-sm font-medium transition-colors duration-150 sm:px-3",
                item.mobile ? "inline-flex" : "hidden sm:inline-flex",
                current ? "bg-surface text-ink" : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <NetworkSwitch />
      {/* The app's own small buttons: RainbowKit's wider one pushed the header past 360 px, and its emoji
          avatar did not fit the product (U3 §6). The account button opens RainbowKit's account modal. */}
      <ConnectButton.Custom>
        {({ account, openAccountModal, openConnectModal, mounted }) =>
          account ? (
            <Button size="sm" variant="secondary" onClick={openAccountModal} className="text-ink">
              <Wallet aria-hidden className="hidden h-3.5 w-3.5 text-accent sm:block" />
              <span className="sm:hidden">{`${account.address.slice(0, 4)}…${account.address.slice(-2)}`}</span>
              <span className="hidden sm:inline">{account.displayName}</span>
            </Button>
          ) : (
            <Button size="sm" variant="nightOutline" disabled={!mounted} onClick={openConnectModal}>
              Connect
            </Button>
          )
        }
      </ConnectButton.Custom>
    </header>
  );
}
