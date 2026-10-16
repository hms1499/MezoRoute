import { mix } from "./contrast";

// U3: one dark palette for the landing and the app (spec 2026-10-16 §3.1). Orange marks BTC exposure
// only; the Stability Pool is lavender; teal is both the action colour and the LP route.
const CANVAS = "#0A1416";
const SURFACE = "#162022";
const INK = "#E8F1EF";
const MUTED = "#9FB3AF";
const LINE = "#222B2D";
const ACCENT = "#2DD4BF";
const ON_ACCENT = "#062221";
const SP = "#A5B4FC";
const BTC = "#FB923C";
const DANGER = "#F87171";
const WARNING = "#FCD34D";

/** A colour at 12% over the panel surface, flattened to a solid hex so the contrast test can check text on it. */
const soft = (hex: string) => mix(hex, SURFACE, 0.12);

/** Colour tokens: the one source for tailwind.config.ts and the contrast test. */
export const colors = {
  canvas: CANVAS,
  surface: SURFACE,
  well: "#0F1A1C",
  ink: INK,
  muted: MUTED,
  line: LINE,
  accent: { DEFAULT: ACCENT, soft: soft(ACCENT) },
  onAccent: ON_ACCENT,
  sp: { DEFAULT: SP, soft: soft(SP) },
  warning: { bg: soft(WARNING), ink: WARNING },
  danger: { DEFAULT: DANGER, soft: soft(DANGER) },
  // Marks BTC-exposure figures and badges only; never a button colour.
  btc: { DEFAULT: BTC, soft: soft(BTC) },
  // U2 landing names, kept as aliases of the same values.
  night: {
    bg: CANVAS,
    glow: "#123B3A",
    panel: SURFACE,
    line: LINE,
    ink: INK,
    muted: MUTED,
    lp: ACCENT,
    sp: SP,
    onLp: ON_ACCENT,
  },
};

/** The simulator dims its table while the typed amount is invalid (`opacity-80`); its text must still pass. */
export const NIGHT_DIM_OPACITY = 0.8;

/** Every text-on-surface pair the UI uses; each must reach WCAG AA (4.5:1). */
const SURFACES = { canvas: colors.canvas, surface: colors.surface, well: colors.well } as Record<string, string>;
const FOREGROUNDS = {
  ink: colors.ink,
  muted: colors.muted,
  accent: colors.accent.DEFAULT,
  sp: colors.sp.DEFAULT,
  btc: colors.btc.DEFAULT,
  danger: colors.danger.DEFAULT,
  warning: colors.warning.ink,
} as Record<string, string>;

export const TEXT_PAIRS: [name: string, foreground: string, background: string][] = [
  ...Object.entries(FOREGROUNDS).flatMap(([fg, fgHex]) =>
    Object.entries(SURFACES).map(([bg, bgHex]): [string, string, string] => [`${fg} on ${bg}`, fgHex, bgHex]),
  ),
  ["onAccent on accent (button)", colors.onAccent, colors.accent.DEFAULT],
  ["canvas on danger (button)", colors.canvas, colors.danger.DEFAULT],
  ["accent on accent-soft", colors.accent.DEFAULT, colors.accent.soft],
  ["sp on sp-soft", colors.sp.DEFAULT, colors.sp.soft],
  ["btc on btc-soft", colors.btc.DEFAULT, colors.btc.soft],
  ["danger on danger-soft", colors.danger.DEFAULT, colors.danger.soft],
  ["warning ink on warning bg", colors.warning.ink, colors.warning.bg],
  ["muted on line (badge)", colors.muted, colors.line],
  ["muted dimmed on surface", mix(colors.muted, colors.surface, NIGHT_DIM_OPACITY), colors.surface],
  ["sp dimmed on surface", mix(colors.sp.DEFAULT, colors.surface, NIGHT_DIM_OPACITY), colors.surface],
  ["ink dimmed on surface", mix(colors.ink, colors.surface, NIGHT_DIM_OPACITY), colors.surface],
];
