import { describe, expect, it } from "vitest";
import { ICLOUD_IGNORE_ATTR, ignoreCommands } from "./icloud-ignore.mjs";

describe("ignoreCommands", () => {
  it("marks .next on macOS", () => {
    expect(ignoreCommands("darwin", "/w")).toEqual([["xattr", ["-w", ICLOUD_IGNORE_ATTR, "1", "/w/.next"]]]);
    expect(ICLOUD_IGNORE_ATTR).toBe("com.apple.fileprovider.ignore#P");
  });

  // next build deletes and recreates out/, which drops the attribute; iCloud then sees a new "out"
  // next to the one it recorded and renames ours to "out 2" (seen 5 Oct 2026). out/ syncs normally.
  it("leaves out/ alone", () => {
    expect(ignoreCommands("darwin", "/w").flatMap(([, args]) => args)).not.toContain("/w/out");
  });

  it("does nothing elsewhere (Vercel builds on Linux)", () => {
    expect(ignoreCommands("linux", "/w")).toEqual([]);
  });
});
