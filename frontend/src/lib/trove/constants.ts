/**
 * Provisional CR safety floor (PRODUCT_SPEC §21, set in F2 on 5 Oct 2026): a borrow never leaves the
 * Trove below 160%, so it survives a 30% BTC drop above the 110% MCR. F4 reuses it.
 */
export const CR_SAFETY_FLOOR = 1_600_000_000_000_000_000n;

/** A Trove is "at risk" when a drop of this size would put it below the protocol MCR. */
export const AT_RISK_DROP_PERCENT = 30;
