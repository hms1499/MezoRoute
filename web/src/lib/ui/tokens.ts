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
];
