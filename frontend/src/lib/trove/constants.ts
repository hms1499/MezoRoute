/**
 * Provisional CR safety floor (PRODUCT_SPEC §21, set in F2 on 5 Oct 2026): a borrow never leaves the
 * Trove below 160%, so it survives a 30% BTC drop above the 110% MCR. F4 reuses it.
 */
export const CR_SAFETY_FLOOR = 1_600_000_000_000_000_000n;

/** A Trove is "at risk" when a drop of this size would put it below the protocol MCR. */
export const AT_RISK_DROP_PERCENT = 30;

/** L1: Leverage and Open never leave the Trove below 200% (PRODUCT_SPEC §4; the contract's own floor is 150%). */
export const LEVERAGE_CR_FLOOR = 2_000_000_000_000_000_000n;

/** L1: the app's default oracle bound for MezoRouteLeverage swaps (the contract caps it at 1,000). */
export const ORACLE_BOUND_DEFAULT_BPS = 500n;

/** MUSD: minimum net debt and the gas compensation every Trove carries on top of it. */
export const MIN_NET_DEBT = 1_800n * 10n ** 18n;
export const GAS_COMPENSATION = 200n * 10n ** 18n;

/** A Close quote covers this much interest accrual between quote and send. */
export const CLOSE_INTEREST_MARGIN_SECONDS = 300n;
