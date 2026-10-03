import { describe, expect, it } from "vitest";
import { RelayError } from "./errors";
import { assertTxHash } from "./send";

describe("assertTxHash", () => {
  it("accepts a 32-byte hash", () => {
    const hash = "0x5f17df95a34e55e6f4b4c4de30ecc9d8ff8acfa2ac37fd779113b03ef83a87bf";
    expect(assertTxHash(hash)).toBe(hash);
  });

  it.each(["0x", "", undefined, null, "0x1234"])("rejects %j as a relay failure", (value) => {
    expect(() => assertTxHash(value)).toThrow(RelayError);
  });
});
