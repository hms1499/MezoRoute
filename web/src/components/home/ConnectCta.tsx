"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ConnectCta({
  label = "Connect a Bitcoin or EVM wallet",
  variant = "primary",
  className,
}: {
  label?: string;
  variant?: "primary" | "night" | "nightOutline";
  className?: string;
}) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Button variant={variant} disabled={!mounted} onClick={openConnectModal} className={className}>
          <Wallet aria-hidden className="h-4 w-4" />
          {label}
        </Button>
      )}
    </ConnectButton.Custom>
  );
}
