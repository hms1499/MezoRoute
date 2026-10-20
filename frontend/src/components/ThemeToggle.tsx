"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { applyTheme, currentTheme, subscribeTheme, type Theme } from "@/lib/ui/theme";

/** The theme on `<html>`; the header and footer controls share it, so both show the same state. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, () => currentTheme(document.documentElement), () => "light");
}

/** Header, from 768 px (below it the Connect button runs past the page): one icon button; its name says what it does (U9). */
export function ThemeToggle() {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Button size="icon" variant="quiet" className="hidden md:inline-flex" aria-label={`Switch to ${next} mode`} onClick={() => applyTheme(next)}>
      <Icon aria-hidden className="h-4 w-4" />
    </Button>
  );
}

const OPTIONS: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** Footer, below 768 px (the header has no room): a Light | Dark switch like the network one. */
export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex w-fit rounded-full bg-surface p-0.5 text-xs md:hidden">
      {OPTIONS.map((option) => {
        const active = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => active || applyTheme(option.id)}
            className={active ? "rounded-full bg-selected px-3 py-1.5 font-semibold text-accent" : "rounded-full px-3 py-1.5 text-muted hover:text-ink"}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
