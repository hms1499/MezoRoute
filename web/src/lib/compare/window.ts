const DAY = 86_400n;
/** The comparison looks back this far (spec F6). */
export const HISTORY_SECONDS = 30n * DAY;
const YEAR = 365n * DAY;
/** Blocks used to measure the recent average block time. */
export const REF_SPAN = 100_000n;

/**
 * The block ≈30 days before `head`, from the average block time over the last REF_SPAN blocks
 * (`refTime` is the timestamp of `head − REF_SPAN`). Block times differ by network and drift, so
 * the caller reads the chosen block's real timestamp and reports that window.
 */
export function pastBlock(head: bigint, headTime: bigint, refTime: bigint): bigint {
  const elapsed = headTime - refTime;
  if (elapsed <= 0n) throw new Error("Block timestamps do not increase");
  const back = (HISTORY_SECONDS * REF_SPAN) / elapsed;
  if (back >= head) throw new Error("The chain is younger than the history window");
  return head - back;
}

/** A 1e18 ratio earned over `seconds`, as a simple yearly rate (no compounding), rounded down. */
export function annualise(ratio: bigint, seconds: bigint): bigint {
  if (seconds <= 0n) throw new Error("Empty history window");
  return (ratio * YEAR) / seconds;
}
