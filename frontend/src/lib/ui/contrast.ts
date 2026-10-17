function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two #RRGGBB colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `fg` drawn at `alpha` opacity over `bg`, as one #RRGGBB colour (for dimmed text). */
export function mix(fg: string, bg: string, alpha: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.replace("#", "").slice(offset, offset + 2), 16);
  const out = [0, 2, 4].map((offset) => Math.round(channel(fg, offset) * alpha + channel(bg, offset) * (1 - alpha)));
  return `#${out.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}
