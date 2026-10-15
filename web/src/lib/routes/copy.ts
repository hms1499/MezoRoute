// Route copy shared by the comparison card and the route pages (Flow B), so they never disagree.

export const LP_RETURN_SOURCE = "Swap fees paid by traders";
export const SP_RETURN_SOURCE = "BTC from liquidations, bought below the debt it repays";

export const LP_RISKS = [
  "Impermanent loss: if the BTC price moves, your pool share can be worth less than holding MUSD.",
  "About half of your deposit becomes BTC. If this MUSD is borrowed against BTC, a BTC drop hits your Trove and this position at the same time.",
  "MezoRoute is unaudited software.",
];

export const SP_RISKS = [
  "Your deposit shrinks when the pool absorbs liquidated debt; you receive that Trove's BTC instead, usually worth more than the debt.",
  "Withdrawals pause while any Trove is under-collateralised. Claiming your BTC gain is never paused.",
  "BTC gains arrive only when liquidations happen, and their value moves with the BTC price.",
];
