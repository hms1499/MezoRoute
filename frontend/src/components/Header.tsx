"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { segmentedItemClass, segmentedTrackClass } from "@/components/ui/Segmented";
import { Logo } from "@/components/ui/Logo";
import { cx } from "@/lib/ui/cx";
import { isCurrentPath, onMobile } from "@/lib/ui/nav";
import { NetworkMenu } from "./NetworkMenu";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/positions/", label: "Positions" },
  // U19: the Proof page needs no wallet; below 640 px it is in the footer instead (`onMobile`).
  { href: "/proof/", label: "Proof" },
];

/** Shared header (spec §9): logo, nav with the current page marked, the network chip (U11), theme toggle (from 768 px), wallet button. */
export function Header() {
  const pathname = usePathname();
  return (
    <header className="flex items-center gap-1 py-4 sm:gap-3 md:gap-4">
      <Link href="/" aria-label="MezoRoute home" className="hit shrink-0 rounded-tip">
        <Logo />
      </Link>
      <div className="flex flex-1 justify-center">
      {/* Below 640 px one link shows (the other main page), so the track drops its padding and fill (U11). */}
      <nav aria-label="Main" className={cx(segmentedTrackClass("md"), "max-sm:bg-transparent max-sm:p-0")}>
        {NAV.map((item) => {
          const current = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cx(segmentedItemClass(current, "md"), !onMobile(item.href, pathname) && "max-sm:hidden")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      </div>
      <NetworkMenu />
      <ThemeToggle />
      {/* The app's own small buttons: RainbowKit's wider one pushed the header past 360 px, and its emoji
          avatar did not fit the product (U3 §6). The account button opens RainbowKit's account modal. */}
      <ConnectButton.Custom>
        {({ account, openAccountModal, openConnectModal, mounted }) =>
          account ? (
            // One line at 360 px (U7). Below 400 px the button keeps only the wallet icon (U11 §5.6, the one give the
            // Geist Mono header needed); its name still says which account it is. The short address runs to 767 px:
            // the display name from 640 px pushed the connected header past the page at 640-686 px (U11 review).
            <Button
              size="md"
              variant="secondary"
              onClick={openAccountModal}
              aria-label={`Account ${account.displayName}`}
              className="shrink-0 whitespace-nowrap text-ink"
            >
              <Wallet aria-hidden className="h-4 w-4 text-accent min-[400px]:max-md:hidden" />
              <span className="hidden min-[400px]:inline md:hidden">{`${account.address.slice(0, 4)}…${account.address.slice(-2)}`}</span>
              <span className="hidden md:inline">{account.displayName}</span>
            </Button>
          ) : (
            <Button size="md" variant="nightOutline" disabled={!mounted} onClick={openConnectModal}>
              Connect
            </Button>
          )
        }
      </ConnectButton.Custom>
    </header>
  );
}
