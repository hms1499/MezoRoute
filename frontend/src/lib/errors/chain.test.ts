import { describe, expect, it } from "vitest";
import { causeChain, chainCodes, chainMessages, chainNames, findRevertData } from "./chain";

describe("causeChain", () => {
  it("walks Error causes outermost first", () => {
    const inner = new Error("inner");
    const outer = new Error("outer", { cause: inner });
    expect(causeChain(outer)).toEqual([outer, inner]);
  });

  it("includes plain objects (OrangeKit's Xverse throws { code, message })", () => {
    const plain = { code: 4001, message: "The user rejected the request." };
    expect(chainCodes(causeChain(plain))).toEqual([4001]);
    expect(chainMessages(causeChain(plain))).toEqual(["The user rejected the request."]);
  });

  it("returns nothing for a non-object", () => {
    expect(causeChain("weird")).toEqual([]);
    expect(causeChain(undefined)).toEqual([]);
  });

  it("stops at the depth limit even on a cyclic chain", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(causeChain(a, 8)).toHaveLength(8);
  });
});

describe("chainMessages and chainNames", () => {
  it("collect shortMessage, message, and details, skipping empty strings", () => {
    const error = { name: "X", shortMessage: "short", message: "long", details: "", cause: { name: "Y", message: "" } };
    expect(chainMessages(causeChain(error))).toEqual(["short", "long"]);
    expect(chainNames(causeChain(error))).toEqual(["X", "Y"]);
  });
});

describe("findRevertData", () => {
  const data = "0x203d82d8";

  it("reads viem's `raw` (ContractFunctionRevertedError)", () => {
    expect(findRevertData(causeChain({ raw: data, data: { errorName: "Expired" } }))).toBe(data);
  });

  it("reads a hex `data` (RpcRequestError, RawContractError) deeper in the chain", () => {
    expect(findRevertData(causeChain({ message: "outer", cause: { data } }))).toBe(data);
  });

  it("reads a nested `data.data`", () => {
    expect(findRevertData(causeChain({ data: { data } }))).toBe(data);
  });

  it("ignores empty data, short hex, and non-hex strings", () => {
    expect(findRevertData(causeChain({ data: "0x" }))).toBeUndefined();
    expect(findRevertData(causeChain({ data: "0x1234" }))).toBeUndefined();
    expect(findRevertData(causeChain({ data: "execution reverted" }))).toBeUndefined();
  });
});
