import { mix } from "./contrast";

export type Theme = "light" | "dark";

/** A colour at an opacity: kept translucent in CSS, flattened over each surface for the contrast test. */
export type Wash = { hex: string; alpha: number };

// U3 roles, two palettes (U9, spec 2026-10-20): orange marks BTC exposure only; the Stability Pool is
// lavender; teal is both the action colour and the LP route. Dark is U3's palette, unchanged; light is the
// default. Both have the same keys; Tailwind and the components only ever see CSS variables.
export type Palette = {
  canvas: string;
  surface: string;
  well: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  sp: string;
  btc: string;
  danger: string;
  warning: string;
  /** The landing's glow behind the hero and the final CTA. */
  glow: string;
  /** A selected option's pill (network, theme): `line` in dark, lighter in light so accent text passes. */
  selected: string;
  /** Opacity of the accent wash behind an outlined control on hover (dark is U3's `bg-accent/10`). */
  accentTint: number;
  /** The primary button on hover and press: dark keeps U3's lighter `/90`, `/80`; light darkens so white text passes. */
  accentHover: Wash;
  accentPressed: Wash;
};

export const palettes: Record<Theme, Palette> = {
  light: {
    canvas: "#EEF4F2",
    surface: "#FFFFFF",
    well: "#F3F7F6",
    ink: "#0B2523",
    muted: "#3F5551",
    line: "#D5E1DE",
    accent: "#0F766E",
    onAccent: "#FFFFFF",
    sp: "#4338CA",
    btc: "#B03A0B",
    danger: "#B91C1C",
    warning: "#92400E",
    glow: "#D3EBE5",
    // U9 audit: accent on `line` is 4.08:1 and accent over a 10% accent wash 4.30:1 in light.
    selected: "#E2EFEE",
    accentTint: 0.04,
    accentHover: { hex: "#0D6B63", alpha: 1 },
    accentPressed: { hex: "#0B5F58", alpha: 1 },
  },
  dark: {
    canvas: "#0A1416",
    surface: "#162022",
    well: "#0F1A1C",
    ink: "#E8F1EF",
    muted: "#9FB3AF",
    line: "#222B2D",
    accent: "#2DD4BF",
    onAccent: "#062221",
    sp: "#A5B4FC",
    btc: "#FB923C",
    danger: "#F87171",
    warning: "#FCD34D",
    glow: "#123B3A",
    selected: "#222B2D",
    accentTint: 0.1,
    accentHover: { hex: "#2DD4BF", alpha: 0.9 },
    accentPressed: { hex: "#2DD4BF", alpha: 0.8 },
  },
};

/** A colour at 12% over the panel surface, flattened to a solid hex so the contrast test can check text on it. */
const soft = (hex: string, p: Palette) => mix(hex, p.surface, 0.12);

/** Every CSS variable (`--color-<name>`) and its value in a palette. */
export const COLOR_VARS = {
  canvas: (p: Palette) => p.canvas,
  surface: (p: Palette) => p.surface,
  well: (p: Palette) => p.well,
  ink: (p: Palette) => p.ink,
  muted: (p: Palette) => p.muted,
  line: (p: Palette) => p.line,
  accent: (p: Palette) => p.accent,
  "accent-soft": (p: Palette) => soft(p.accent, p),
  "on-accent": (p: Palette) => p.onAccent,
  sp: (p: Palette) => p.sp,
  "sp-soft": (p: Palette) => soft(p.sp, p),
  btc: (p: Palette) => p.btc,
  "btc-soft": (p: Palette) => soft(p.btc, p),
  danger: (p: Palette) => p.danger,
  "danger-soft": (p: Palette) => soft(p.danger, p),
  "warning-ink": (p: Palette) => p.warning,
  "warning-bg": (p: Palette) => soft(p.warning, p),
  glow: (p: Palette) => p.glow,
  selected: (p: Palette) => p.selected,
  // A full colour, not channels: dark keeps today's translucent wash.
  "accent-tint": (p: Palette) => wash({ hex: p.accent, alpha: p.accentTint }),
  "accent-hover": (p: Palette) => wash(p.accentHover),
  "accent-pressed": (p: Palette) => wash(p.accentPressed),
} satisfies Record<string, (p: Palette) => string>;

export type ColorVar = keyof typeof COLOR_VARS;

/** `#RRGGBB` as `R G B`, the form `rgb(var(--x) / <alpha-value>)` needs; any other value passes through. */
function channels(value: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(" ");
}

function wash({ hex, alpha }: Wash): string {
  return `rgb(${channels(hex)} / ${alpha})`;
}

function variablesFor(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(COLOR_VARS)) vars[`--color-${name}`] = channels(value(palettes[theme]));
  return { ...vars, "color-scheme": theme };
}

/** The CSS the Tailwind plugin writes: light on `:root` (the default), dark when `<html data-theme="dark">`. */
export function themeVariables(): Record<string, Record<string, string>> {
  return { ":root": variablesFor("light"), ':root[data-theme="dark"]': variablesFor("dark") };
}

const tw = (name: ColorVar) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** Colour tokens for tailwind.config.ts: every class (`bg-surface`, `bg-accent/10`…) follows the theme. */
export const colors = {
  canvas: tw("canvas"),
  surface: tw("surface"),
  well: tw("well"),
  ink: tw("ink"),
  muted: tw("muted"),
  line: tw("line"),
  selected: tw("selected"),
  accent: {
    DEFAULT: tw("accent"),
    soft: tw("accent-soft"),
    tint: "var(--color-accent-tint)",
    hover: "var(--color-accent-hover)",
    pressed: "var(--color-accent-pressed)",
  },
  onAccent: tw("on-accent"),
  sp: { DEFAULT: tw("sp"), soft: tw("sp-soft") },
  warning: { bg: tw("warning-bg"), ink: tw("warning-ink") },
  danger: { DEFAULT: tw("danger"), soft: tw("danger-soft") },
  // Marks BTC-exposure figures and badges only; never a button colour.
  btc: { DEFAULT: tw("btc"), soft: tw("btc-soft") },
  // U2 landing names, kept as aliases of the same variables.
  night: {
    bg: tw("canvas"),
    glow: tw("glow"),
    panel: tw("surface"),
    line: tw("line"),
    ink: tw("ink"),
    muted: tw("muted"),
    lp: tw("accent"),
    sp: tw("sp"),
    onLp: tw("on-accent"),
  },
};

/** The same variables as plain CSS colours, for SVG and style objects in TypeScript (never a hex). */
export const themeColor = Object.fromEntries(Object.keys(COLOR_VARS).map((name) => [name, `rgb(var(--color-${name}))`])) as Record<
  ColorVar,
  string
>;

// U6: the one type scale (spec 2026-10-17-u6-type-scale-design.md). Tailwind knows only these sizes, and
// `typography.test.ts` fails on any other size, line height, or weight in the source.
type TypeMeta = { lineHeight: string; fontWeight?: string; letterSpacing?: string };
const TIGHT = "-0.025em";

export type FontSizeKey = "xs" | "sm" | "base" | "xl" | "headline" | "title" | "figure" | "display" | "display-lg";

/** Size and line height per step; role tokens also fix weight and tracking. Weight 300 only in `display*` (U10). */
export const fontSize: Record<FontSizeKey, [size: string, meta: TypeMeta]> = {
  xs: ["12px", { lineHeight: "16px" }],
  sm: ["14px", { lineHeight: "20px" }],
  base: ["16px", { lineHeight: "24px" }],
  xl: ["20px", { lineHeight: "28px" }],
  headline: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: TIGHT }],
  title: ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: TIGHT }],
  figure: ["28px", { lineHeight: "32px", fontWeight: "500", letterSpacing: TIGHT }],
  // U10: light display type, as on morpho.org (Inter is a variable font, so 300 costs no download).
  display: ["40px", { lineHeight: "48px", fontWeight: "300", letterSpacing: "-0.02em" }],
  "display-lg": ["48px", { lineHeight: "52px", fontWeight: "300", letterSpacing: "-0.02em" }],
};

/** SVG chart text (axis, values, bands): the scale's floor. */
export const CHART_FONT_PX = 12;

/** The simulator dims its table while the typed amount is invalid (`opacity-80`); its text must still pass. */
export const NIGHT_DIM_OPACITY = 0.8;

/** Every text-on-surface pair the UI uses in one palette; each must reach WCAG AA (4.5:1). */
export function textPairs(p: Palette): [name: string, foreground: string, background: string][] {
  const surfaces: Record<string, string> = { canvas: p.canvas, surface: p.surface, well: p.well };
  const foregrounds: Record<string, string> = {
    ink: p.ink,
    muted: p.muted,
    accent: p.accent,
    sp: p.sp,
    btc: p.btc,
    danger: p.danger,
    warning: p.warning,
  };
  return [
    ...Object.entries(foregrounds).flatMap(([fg, fgHex]) =>
      Object.entries(surfaces).map(([bg, bgHex]): [string, string, string] => [`${fg} on ${bg}`, fgHex, bgHex]),
    ),
    ["onAccent on accent (button)", p.onAccent, p.accent],
    // U10: a filled button's arrow circle is onAccent with an accent arrow.
    ["accent on onAccent (arrow circle on primary)", p.accent, p.onAccent],
    ["canvas on danger (button)", p.canvas, p.danger],
    ["accent on accent-soft", p.accent, soft(p.accent, p)],
    ["sp on sp-soft", p.sp, soft(p.sp, p)],
    ["btc on btc-soft", p.btc, soft(p.btc, p)],
    ["danger on danger-soft", p.danger, soft(p.danger, p)],
    ["warning ink on warning bg", p.warning, soft(p.warning, p)],
    ["muted on line (badge)", p.muted, p.line],
    ["muted dimmed on surface", mix(p.muted, p.surface, NIGHT_DIM_OPACITY), p.surface],
    ["sp dimmed on surface", mix(p.sp, p.surface, NIGHT_DIM_OPACITY), p.surface],
    ["ink dimmed on surface", mix(p.ink, p.surface, NIGHT_DIM_OPACITY), p.surface],
    // U9 audit: states and selected options the list above did not see; translucent fills flattened over
    // each surface they sit on.
    ["accent on selected (network, theme)", p.accent, p.selected],
    ["ink on line (selected tab)", p.ink, p.line],
    ...Object.entries(surfaces).flatMap(([bg, bgHex]): [string, string, string][] => [
      [`accent on accent-tint over ${bg} (${bg === "well" ? "Max" : "outline"} hover)`, p.accent, mix(p.accent, bgHex, p.accentTint)],
      [`onAccent on accent-hover over ${bg} (button hover)`, p.onAccent, mix(p.accentHover.hex, bgHex, p.accentHover.alpha)],
      [`onAccent on accent-pressed over ${bg} (button pressed)`, p.onAccent, mix(p.accentPressed.hex, bgHex, p.accentPressed.alpha)],
      [`canvas on danger/90 over ${bg} (button hover)`, p.canvas, mix(p.danger, bgHex, 0.9)],
    ]),
  ];
}

export const TEXT_PAIRS: [name: string, foreground: string, background: string][] = (["light", "dark"] as const).flatMap((theme) =>
  textPairs(palettes[theme]).map(([name, fg, bg]): [string, string, string] => [`${theme}: ${name}`, fg, bg]),
);
