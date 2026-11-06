"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useNetwork } from "@/lib/config/network-context";
import type { NetworkId } from "@/lib/config/networks";
import { cx } from "@/lib/ui/cx";
import { menuKeys, triggerKey } from "@/lib/ui/menu";
import { themeColor } from "@/lib/ui/tokens";

const OPTIONS: { id: NetworkId; label: string; short: string; dot: string }[] = [
  { id: "testnet", label: "Testnet", short: "Test", dot: themeColor.accent },
  { id: "mainnet", label: "Mainnet", short: "Main", dot: themeColor.btc },
];

/**
 * U11 §5.6: the header's network chip, as Aave and Aerodrome show the chain: a dot, the network's name, and a menu
 * with both networks. Choosing the other one stores it and reloads (Passport builds one chain per wagmi config).
 */
export function NetworkMenu() {
  const { network, switchNetwork } = useNetwork();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = OPTIONS.find((option) => option.id === network.id) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    items.current[focus]?.focus();
  }, [open, focus]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function choose(id: NetworkId) {
    close(true);
    if (id !== network.id) switchNetwork(id);
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const result = menuKeys(event.key, focus, OPTIONS.length);
    if (result === null) return;
    if (result !== "close" || event.key !== "Tab") event.preventDefault();
    if (result === "close") close(event.key !== "Tab");
    else if (result === "activate") choose(OPTIONS[focus].id);
    else setFocus(result.index);
  }

  function openMenu(at = OPTIONS.findIndex((option) => option.id === network.id)) {
    setFocus(at);
    setOpen(true);
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Network: ${current.label}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(event) => {
          const at = triggerKey(event.key, OPTIONS.findIndex((option) => option.id === network.id), OPTIONS.length);
          if (at === null) return;
          event.preventDefault();
          openMenu(at);
        }}
        // Below 400 px a disconnected header (Connect, not the account icon) has no room for the full name.
        className={buttonClass("quiet", "sm", "max-[399px]:gap-1")}
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-pill" style={{ backgroundColor: current.dot }} />
        <span className="text-ink max-[399px]:hidden">{current.label}</span>
        <span aria-hidden className="text-ink min-[400px]:hidden">
          {current.short}
        </span>
        <ChevronDown aria-hidden className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Network"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-2 w-40 rounded-tip border border-line bg-surface p-1 shadow-overlay"
        >
          {OPTIONS.map((option, index) => {
            const selected = option.id === network.id;
            return (
              <button
                key={option.id}
                ref={(node) => {
                  items.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={index === focus ? 0 : -1}
                onClick={() => choose(option.id)}
                className="hit flex min-h-9 w-full items-center gap-2 rounded-tip px-3 text-left text-sm text-ink hover:bg-well focus-visible:bg-well"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-pill" style={{ backgroundColor: option.dot }} />
                <span className="flex-1">{option.label}</span>
                {selected && <Check aria-hidden className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
