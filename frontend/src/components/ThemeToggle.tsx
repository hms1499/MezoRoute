"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
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

/** Footer, below 768 px (the header has no room): a Light | Dark switch. */
export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <Segmented
      label="Theme"
      size="sm"
      className="md:hidden"
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
      value={theme}
      onChange={(next: Theme) => applyTheme(next)}
    />
  );
}
