import { formatToken } from "@/lib/format";

export const musd = (value: bigint) => `${formatToken(value, 18, 4)} MUSD`;
export const btc = (value: bigint) => `${formatToken(value)} BTC`;
export const lp = (value: bigint) => `${formatToken(value)} LP`;
