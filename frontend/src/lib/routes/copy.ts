// Route copy shared by the comparison card and the route pages (Flow B), so they never disagree.

export const LP_RETURN_SOURCE = "Swap fees from traders, or MEZO from the gauge if you stake";
export const SP_RETURN_SOURCE = "BTC from liquidations, bought below the debt it repays";

export const LP_RISKS = [
  "Impermanent loss: if the BTC price moves, your pool share can be worth less than holding MUSD.",
  "About half of your deposit becomes BTC. If this MUSD is borrowed against BTC, a BTC drop hits your Trove and this position at the same time.",
  "MEZO rewards change weekly and are paid in a token whose price can fall.",
  "MezoRoute is unaudited software.",
];

/** The BTC entry swaps about half of the BTC to MUSD, so the second risk differs from the MUSD route's. */
export const LP_BTC_RISKS = [
  LP_RISKS[0],
  "About half of your BTC is swapped to MUSD before it is deposited. Your pool share still moves with the BTC price, and the swap pays the pool's fee.",
  LP_RISKS[2],
  LP_RISKS[3],
];

export const SP_RISKS = [
  "Your deposit shrinks when the pool absorbs liquidated debt; you receive that Trove's BTC instead, usually worth more than the debt.",
  "Withdrawals pause while any Trove is under-collateralised. Claiming your BTC gain is never paused.",
  "BTC gains arrive only when liquidations happen, and their value moves with the BTC price.",
];

// U19: Mezo's MUSD Savings Vault (sMUSD), compared read-only; MezoRoute does not route into it.
export const SAVINGS_RETURN_SOURCE = "MUSD paid by the protocol, or MEZO from the vault's gauge if you stake";

export const SAVINGS_RISKS = [
  "The yield is paid by Mezo's protocol and can stop or change.",
  "The vault is upgradeable by its owner, unlike MezoRoute's contracts.",
  "MEZO's rate and price change weekly.",
];
