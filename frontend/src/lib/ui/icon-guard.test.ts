import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// U10 §8: an icon's size follows the text beside it (12 px text → 14 px, 14–16 px → 16 px, 20 px and up → 20 px), with
// lucide's own 2 px stroke. Only the named illustrative icons go bigger.

const SRC = join(__dirname, "../..");
const ICON_SIZES = ["3.5", "4", "5"];
/** Illustrative icons sized on purpose: the receipt's status (48 px), the empty Positions state, the wallet avatar. */
const ICON_EXCEPTIONS: Record<string, string[]> = {
  "components/receipt/ReceiptPage.tsx": ["Clock", "CircleCheck", "CircleX"],
  "components/positions/PositionsPage.tsx": ["Inbox"],
  "app/providers.tsx": ["Wallet"],
};

function tsxFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [relative(SRC, path)] : [];
  });
}

/** The lucide names a file imports, plus `Icon` where a component takes a `LucideIcon` prop under that name. */
function iconNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/import \{([^}]*)\} from "lucide-react"/g))
    for (const part of match[1].split(",")) {
      const name = part.replace(/\btype\b/, "").split(" as ").pop()!.trim();
      if (/^[A-Z]/.test(name) && name !== "LucideIcon") names.add(name);
    }
  if (/\bicon: Icon\b/.test(source)) names.add("Icon");
  return names;
}

/** What is wrong with one icon's attributes, if anything. */
export function iconOffence(attributes: string): string | null {
  if (/\b(strokeWidth|absoluteStrokeWidth|size)=/.test(attributes)) return "stroke or size prop";
  const heights = [...attributes.matchAll(/\bh-([\d.]+)\b/g)].map((m) => m[1]);
  const widths = [...attributes.matchAll(/\bw-([\d.]+)\b/g)].map((m) => m[1]);
  if (heights.length === 0 && widths.length === 0) return "no size";
  if (heights.join() !== widths.join()) return "unequal";
  return heights.every((size) => ICON_SIZES.includes(size)) ? null : "off-scale";
}

describe("icon sizes (U10 §8)", () => {
  it("catches each rule", () => {
    expect(iconOffence(' aria-hidden className="h-3 w-3"')).toBe("off-scale");
    expect(iconOffence(' className="h-4 w-5"')).toBe("unequal");
    expect(iconOffence(' className="h-4 w-4" strokeWidth={1.5}')).toBe("stroke or size prop");
    expect(iconOffence(" aria-hidden")).toBe("no size");
    expect(iconOffence(' className={cx("btn-arrow", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}')).toBeNull();
    expect(iconOffence(' className="h-5 w-5 text-accent"')).toBeNull();
  });

  it("finds no icon off the scale", () => {
    const hits = tsxFiles().flatMap((file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      const names = iconNames(source);
      const allowed = ICON_EXCEPTIONS[file] ?? [];
      return [...source.matchAll(/<([A-Z]\w*)\b([^>]*?)\/?>/g)]
        .filter(([, name]) => names.has(name) && !allowed.includes(name))
        .flatMap((match) => {
          const [, name, attributes] = match;
          const offence = iconOffence(attributes);
          const line = source.slice(0, match.index).split("\n").length;
          return offence ? [`${file}:${line} ${name} ${offence}`] : [];
        });
    });
    expect(hits).toEqual([]);
  });
});
