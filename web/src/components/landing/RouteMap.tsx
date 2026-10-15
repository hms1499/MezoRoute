"use client";

import { useId } from "react";
import { colors } from "@/lib/ui/tokens";
import { cx } from "@/lib/ui/cx";
import type { Highlight } from "./Landing";

const LP_PATH = "M14 110 C 120 110, 150 40, 260 40 S 400 30, 470 26";
const SP_PATH = "M14 110 C 120 110, 160 140, 270 140 S 410 140, 470 138";

/** MUSD splitting into the two routes (U2 signature). Decorative: the simulator carries the meaning. */
export function RouteMap({ highlight, className }: { highlight: Highlight; className?: string }) {
  const maskId = `sp-reveal-${useId().replace(/:/g, "")}`;
  const glow = (route: "lp" | "sp") => (highlight === route ? `drop-shadow(0 0 6px ${colors.night[route]})` : undefined);
  return (
    <svg viewBox="0 0 480 160" aria-hidden className={cx("w-full overflow-visible", className)}>
      <defs>
        {/* The dashed Stability Pool line is revealed by a solid stroke drawing in underneath it. */}
        <mask id={maskId}>
          <path d={SP_PATH} fill="none" stroke="white" strokeWidth={8} className="landing-draw" style={{ animationDelay: "550ms" }} />
        </mask>
      </defs>
      <path
        d={LP_PATH}
        fill="none"
        stroke={colors.night.lp}
        strokeWidth={highlight === "lp" ? 4 : 2.5}
        strokeLinecap="round"
        className="landing-draw transition-[stroke-width] duration-200"
        style={{ animationDelay: "350ms", filter: glow("lp") }}
      />
      <path
        d={SP_PATH}
        fill="none"
        stroke={colors.night.sp}
        strokeWidth={highlight === "sp" ? 4 : 2.5}
        strokeDasharray="6 7"
        mask={`url(#${maskId})`}
        className="transition-[stroke-width] duration-200"
        style={{ filter: glow("sp") }}
      />
      <circle cx="14" cy="110" r="6" fill={colors.night.ink} />
      <circle r="4" fill={colors.night.lp} className="landing-travel" style={{ offsetPath: `path("${LP_PATH}")`, animationDelay: "1.6s" }} />
      <circle
        r="4"
        fill={colors.night.sp}
        className="landing-travel"
        style={{ offsetPath: `path("${SP_PATH}")`, animationDelay: "2s", animationDuration: "4.4s" }}
      />
      <text x="2" y="96" fill={colors.night.muted} fontSize="11" fontFamily="var(--font-mono)">
        MUSD
      </text>
      <text x="330" y="18" fill={colors.night.lp} fontSize="11" fontFamily="var(--font-mono)">
        LP
      </text>
      <text x="350" y="128" fill={colors.night.sp} fontSize="11" fontFamily="var(--font-mono)">
        SP
      </text>
    </svg>
  );
}
