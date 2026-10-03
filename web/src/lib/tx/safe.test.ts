import { describe, expect, it } from "vitest";
import { hasSafeExecutionFailure, SAFE_EXECUTION_FAILURE_TOPIC } from "./safe";

describe("hasSafeExecutionFailure", () => {
  it("uses the ExecutionFailure(bytes32,uint256) topic", () => {
    expect(SAFE_EXECUTION_FAILURE_TOPIC).toBe("0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23");
  });

  it("flags a relayed transaction whose inner call reverted", () => {
    expect(hasSafeExecutionFailure([{ topics: [SAFE_EXECUTION_FAILURE_TOPIC] }])).toBe(true);
  });

  it("passes ExecutionSuccess and ordinary logs", () => {
    const success = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";
    expect(hasSafeExecutionFailure([{ topics: [success] }, { topics: [] }])).toBe(false);
  });
});
