"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
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
      <nav aria-label="Main" className="mr-auto flex items-center gap-1">
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
                current ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <NetworkSwitch />
      {/* Disconnected, the app's small button: RainbowKit's wider one pushed the header past 360 px. */}
      <ConnectButton.Custom>
        {({ account, openConnectModal, mounted }) =>
          account ? (
            <ConnectButton chainStatus="none" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
          ) : (
            <Button size="sm" disabled={!mounted} onClick={openConnectModal}>
              Connect
            </Button>
          )
        }
      </ConnectButton.Custom>
    </header>
  );
}
