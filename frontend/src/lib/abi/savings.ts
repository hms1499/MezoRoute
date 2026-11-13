// U19: the two reads the app makes of Mezo's MUSD Savings Vault (`MUSDSavingsRate`, verified on the mainnet explorer).
export const savingsVaultAbi = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "yieldIndex", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;
