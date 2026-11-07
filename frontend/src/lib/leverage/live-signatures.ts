// Real authorisations signed by the testnet deployer and submitted in the L1 smoke run
// (contracts/script/smoke-leverage-testnet.sh, 7 Nov 2026; tx hashes in docs/STATUS.md).
export const LIVE_SIGNER = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49" as const;

export const LIVE_UNWIND = {
  primaryType: "AdjustTrove",
  message: {
    collWithdrawal: 649042589452686n,
    debtChange: 50000000000000000000n,
    isDebtIncrease: false,
    assetAmount: 0n,
    borrower: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    recipient: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    nonce: 7n,
    deadline: 1794019902n,
  },
  signature: "0xc6375acad3d0467bbbecbc6a438c710b0b30bb8f8cc74982c6d109ecc847faa224a31b79bc73ee99971d2b30ae64d40c4cda27bc7c97e4d03a705d506a92fa7f1c",
} as const;

export const LIVE_LEVERAGE = {
  primaryType: "AdjustTrove",
  message: {
    collWithdrawal: 0n,
    debtChange: 160586556193210579847n,
    isDebtIncrease: true,
    assetAmount: 2000000000000000n,
    borrower: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    recipient: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    nonce: 8n,
    deadline: 1794019927n,
  },
  signature: "0xa1bcd4ee649c71dca043fe61655498e95f6fa02e290cc0dc8d81d5e5d77afc4c295173849ab53597f7668e4ebc41259b9ca53bb734563339c2970391aacf1a091c",
} as const;

export const LIVE_CLOSE = {
  primaryType: "CloseTrove",
  message: {
    borrower: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    recipient: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    nonce: 9n,
    deadline: 1794019945n,
  },
  signature: "0x31a7587d99aa3c485b523b70fadeef85396f620d9a8be0584754334a57a94b9030d55554be52d3fe04844ed72712c9b3286c6d7972917fea8e79c4a1e8f0493c1b",
} as const;

export const LIVE_OPEN = {
  primaryType: "OpenTrove",
  message: {
    assetAmount: 45000000000000000n,
    debtAmount: 1800000000000000000000n,
    borrower: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    recipient: "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49",
    nonce: 10n,
    deadline: 1794019970n,
  },
  signature: "0x3e2870a298bb30aafca946440da6376b813e8fc502bca399e1731bc51f65d57b624267eb8883628e30b6633fed97aa5bb889168266ad3b70c6bdaa0964f4894d1b",
} as const;
