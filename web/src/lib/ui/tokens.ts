/** Colour tokens (U1): the one source for tailwind.config.ts and the contrast test. */
export const colors = {
  canvas: "#F6F8F7",
  ink: "#1F2A2E",
  muted: "#4B5B5F",
  line: "#E4ECEA",
  accent: { DEFAULT: "#0F766E", soft: "#ECF5F3" },
  warning: { bg: "#FEF3C7", ink: "#92400E" },
  danger: { DEFAULT: "#B42318", soft: "#FEECEB" },
  // Marks BTC-exposure figures and badges only; never a button colour.
  btc: { DEFAULT: "#C2410C", soft: "#FFF4EC" },
  // U2 landing only: a deep teal-black page with the two route colours (LP teal, Stability Pool orange).
  // panel and line are white 5% / 10% over bg, flattened to solid colours so the contrast test can check them.
  night: {
    bg: "#0A1416",
    glow: "#123B3A",
    panel: "#162022",
    line: "#222B2D",
    ink: "#E8F1EF",
    muted: "#9FB3AF",
    lp: "#2DD4BF",
    sp: "#FB923C",
    onLp: "#062221",
  },
};

const WHITE = "#FFFFFF";

/** Every text-on-surface pair the UI uses; each must reach WCAG AA (4.5:1). */
export const TEXT_PAIRS: [name: string, foreground: string, background: string][] = [
  ["ink on canvas", colors.ink, colors.canvas],
  ["ink on white", colors.ink, WHITE],
  ["muted on white", colors.muted, WHITE],
  ["muted on canvas", colors.muted, colors.canvas],
  ["muted on line (badge)", colors.muted, colors.line],
  ["accent on white", colors.accent.DEFAULT, WHITE],
  ["white on accent", WHITE, colors.accent.DEFAULT],
  ["accent on accent-soft", colors.accent.DEFAULT, colors.accent.soft],
  ["warning ink on warning bg", colors.warning.ink, colors.warning.bg],
  ["danger on white", colors.danger.DEFAULT, WHITE],
  ["danger on danger-soft", colors.danger.DEFAULT, colors.danger.soft],
  ["white on danger", WHITE, colors.danger.DEFAULT],
  ["btc on white", colors.btc.DEFAULT, WHITE],
  ["btc on btc-soft", colors.btc.DEFAULT, colors.btc.soft],
  ["white on ink (toast)", WHITE, colors.ink],
  ["night ink on night bg", colors.night.ink, colors.night.bg],
  ["night muted on night bg", colors.night.muted, colors.night.bg],
  ["night ink on night panel", colors.night.ink, colors.night.panel],
  ["night muted on night panel", colors.night.muted, colors.night.panel],
  ["night lp on night bg", colors.night.lp, colors.night.bg],
  ["night lp on night panel", colors.night.lp, colors.night.panel],
  ["night sp on night bg", colors.night.sp, colors.night.bg],
  ["night sp on night panel", colors.night.sp, colors.night.panel],
  ["night on-lp on lp (CTA)", colors.night.onLp, colors.night.lp],
];
