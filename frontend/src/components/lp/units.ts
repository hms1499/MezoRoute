import { formatToken } from "@/lib/format";

export const musd = (value: bigint) => `${formatToken(value, 18, 4)} MUSD`;
export const btc = (value: bigint) => `${formatToken(value)} BTC`;
/** BTC to eight decimals: a BTC entry is a fraction of a coin, so six would round the fee and the leftovers to "<0.000001". */
export const btcFine = (value: bigint) => `${formatToken(value, 18, 8)} BTC`;
export const lp = (value: bigint) => `${formatToken(value)} LP`;

/** A signed MUSD change: "+1.5 MUSD" / "−0.06 MUSD" (true minus sign). */
export const signedMusd = (value: bigint) => (value < 0n ? `−${musd(-value)}` : `+${musd(value)}`);
