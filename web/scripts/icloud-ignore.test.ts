import { describe, expect, it } from "vitest";
import { ICLOUD_IGNORE_ATTR, ignoreCommands } from "./icloud-ignore.mjs";

describe("ignoreCommands", () => {
  it("marks .next and out on macOS", () => {
    expect(ignoreCommands("darwin", "/w")).toEqual([
      ["xattr", ["-w", ICLOUD_IGNORE_ATTR, "1", "/w/.next"]],
      ["xattr", ["-w", ICLOUD_IGNORE_ATTR, "1", "/w/out"]],
    ]);
    expect(ICLOUD_IGNORE_ATTR).toBe("com.apple.fileprovider.ignore#P");
  });

  it("does nothing elsewhere (Vercel builds on Linux)", () => {
    expect(ignoreCommands("linux", "/w")).toEqual([]);
  });
});
